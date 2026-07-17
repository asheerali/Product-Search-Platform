"""
Product analyzer - extracts structured product data from raw text
(from PDFs/PPTX/XLSX) and from product images using the configured LLM provider.
"""
import json
import logging

from app.services.ai.llm.llm_client import chat_completion, vision_completion

logger = logging.getLogger(__name__)

TEXT_EXTRACTION_PROMPT = """You are a furniture product data extraction expert.
Extract ALL distinct products mentioned in the following text/table data.

For each product return a JSON object with these fields:
- title (string): product name
- category (string): one of [sofa, chair, table, bed, wardrobe, cabinet, desk, shelf, lamp, other]
- material (string): primary material(s)
- style (string): design style (modern, traditional, Scandinavian, industrial, etc.)
- color (string): primary color(s)
- width_mm (number or null): width in mm - convert from cm (x10) or inches (x25.4) if needed
- depth_mm (number or null): depth in mm
- height_mm (number or null): height in mm
- price (number or null): numeric price
- currency (string): currency code, default "USD"
- supplier_sku (string or null): product code or model number
- description (string): brief product description
- raw_attributes (object): any other found attributes as key-value pairs
- confidence (number): 0-1, how confident you are in this extraction

Return ONLY a valid JSON array. Return [] if no products are found. No markdown, no explanation.

Data:
{text}
"""

IMAGE_ANALYSIS_PROMPT = """You are an expert furniture product analyst.
Analyze this furniture product image carefully.

Return a JSON object with:
- title (string): product name/type (e.g. "3-seater sofa", "dining chair")
- category (string): one of [sofa, chair, table, bed, wardrobe, cabinet, desk, shelf, lamp, other]
- material (string): likely material(s) based on visual appearance
- style (string): design style
- color (string): primary color(s)
- estimated_width_mm (number or null): estimated width based on proportions
- estimated_height_mm (number or null): estimated height
- description (string): detailed visual description useful for matching
- confidence (number): 0-1
- tags (array of strings): descriptive tags for search

Return ONLY valid JSON. No markdown.
"""


class ProductAnalyzer:
    def extract_from_text(
        self,
        text: str,
        tables: list[list[dict]] | None = None,
        supplier_name: str = "",
    ) -> list[dict]:
        """Extract structured product records from raw text + optional tables."""
        # Combine text and table data
        combined = text
        if tables:
            for table in tables:
                table_text = "\n".join(
                    " | ".join(f"{k}: {v}" for k, v in row.items() if v)
                    for row in table
                )
                combined += "\n\nTable:\n" + table_text

        # Truncate to avoid token overflow (approx 20k chars)
        combined = combined[:20000]
        if not combined.strip():
            return []

        prompt = TEXT_EXTRACTION_PROMPT.format(text=combined)
        messages = [{"role": "user", "content": prompt}]

        try:
            response = chat_completion(messages=messages, temperature=0.1, max_tokens=4096)
            products = json.loads(response.strip())
            if not isinstance(products, list):
                return []
            # Inject supplier name where missing
            for p in products:
                if supplier_name and not p.get("supplier_name"):
                    p["supplier_name"] = supplier_name
            return products
        except json.JSONDecodeError as e:
            logger.warning("Could not parse product JSON from LLM response: %s", e)
            return []
        except Exception as e:
            logger.error("Text product extraction error: %s", e)
            return []

    def extract_from_image(self, image_path: str) -> list[dict]:
        """Analyze a product image and return extracted product data."""
        try:
            response = vision_completion(image_path=image_path, prompt=IMAGE_ANALYSIS_PROMPT)
            data = json.loads(response.strip())
            if isinstance(data, dict):
                # Map estimated dimensions to standard fields
                data["width_mm"] = data.pop("estimated_width_mm", None)
                data["height_mm"] = data.pop("estimated_height_mm", None)
                data["raw_attributes"] = {"tags": data.pop("tags", [])}
                return [data]
            return []
        except json.JSONDecodeError as e:
            logger.warning("Could not parse image analysis JSON: %s", e)
            return []
        except Exception as e:
            logger.error("Image product extraction error: %s", e)
            return []

    def generate_comparison(self, products: list[dict], query: str = "") -> str:
        """Generate a natural-language comparison between multiple products."""
        if not products:
            return ""

        products_text = json.dumps(products, indent=2)
        prompt = f"""You are a furniture sourcing expert. Compare these products and provide a concise analysis.
Focus on: style differences, material quality, price-value ratio, and best use cases.
{f'User context: {query}' if query else ''}

Products:
{products_text}

Write a clear, helpful comparison (3-5 sentences per product, then a recommendation).
"""
        messages = [{"role": "user", "content": prompt}]
        try:
            return chat_completion(messages=messages, temperature=0.4, max_tokens=1024)
        except Exception as e:
            logger.error("Comparison generation failed: %s", e)
            return ""
