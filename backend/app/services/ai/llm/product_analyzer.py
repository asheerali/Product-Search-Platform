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

PPTX_SLIDE_EXTRACTION_PROMPT = """You are a furniture product data extraction expert analyzing ONE SLIDE from a
supplier's PPTX catalog deck. Each slide is normally one base product, but the
slide's table may list several purchasable size/config variants of it
(e.g. 1S/2S/3S, or "Sectional (3 Pcs)") — treat each variant as a separate product.

Extract every distinct variant mentioned in this slide's text/table data:
model number, size/description code, dimensions (CM), CBM, materials/fabric
spec, price (USD), packaging quantity (e.g. "40HQ/Qty"), and any other
printed attributes.

For each variant return a JSON object with these fields:
- title (string): product name, including the size/variant code (e.g. "CFL-S658 MD Foam 1S Sofa")
- category (string): one of [sofa, chair, table, bed, wardrobe, cabinet, desk, shelf, lamp, other]
- material (string): primary material(s)
- style (string): design style (modern, traditional, Scandinavian, industrial, etc.)
- color (string): primary color(s)
- width_mm (number or null): width in mm - convert from cm (x10) or inches (x25.4) if needed
- depth_mm (number or null): depth in mm
- height_mm (number or null): height in mm
- price (number or null): numeric price
- currency (string): currency code, default "USD"
- supplier_sku (string or null): model/product code, including the variant suffix if present
- description (string): brief product description
- raw_attributes (object): any other found attributes as key-value pairs (e.g. cbm, packaging_qty)
- confidence (number): 0-1, how confident you are in this extraction

Ignore any logos, watermarks, or company branding mentioned in the slide — they are not products.

Return ONLY a valid JSON array, one object per variant. Return [] if no products are found on this slide. No markdown, no explanation.

Slide data:
{text}
"""

IMAGE_ANALYSIS_PROMPT = """You are an expert furniture product data analyst with strong OCR ability.

This image is one of two kinds:
(a) a plain photo of a furniture product, or
(b) a supplier spec sheet / price table listing one or more product variants, with
    printed text such as model numbers, dimensions, CBM, materials, prices, and quantities.

First decide which kind it is by looking for a table, grid lines, or printed text/numbers.

If it is a spec sheet / table (kind b):
- READ THE PRINTED TEXT EXACTLY. Never guess or invent a value that is printed in the
  image — copy the digits/words as shown (model codes, sizes, prices, materials, qty).
- Treat each distinct row/variant as a separate product (e.g. "Arm Chair", "Armless Chair",
  "Chaise", "Sectional (3 Pcs)" under the same model are 4 separate products). Include the
  base model code in each variant's title and in supplier_sku.
- Only use visual inspection (color, style) to fill in gaps the text doesn't cover.
- Set confidence close to 1.0 for values read directly as printed text.

If it is a plain product photo with no table/text (kind a):
- Return a single product based on your best visual estimate.
- Set confidence lower (around 0.3-0.5) since these are visual guesses, not confirmed data.

Return a JSON ARRAY of product objects (even if there is only one). Each object has:
- title (string): product name, including model/variant name if present
- category (string): one of [sofa, chair, table, bed, wardrobe, cabinet, desk, shelf, lamp, other]
- material (string): material(s) — read literally from any material/fabric label if present
- style (string): design style
- color (string or null): primary color(s), or null if not visually determinable
- width_mm (number or null): width in mm
- depth_mm (number or null): depth in mm
- height_mm (number or null): height in mm
  (convert from cm with x10 or inches with x25.4; a combined "W*D*H" string like
  "105*101*89" in cm is width*depth*height — split it into the three fields)
- price (number or null): numeric price with currency symbols stripped
- currency (string): currency code, default "USD"
- supplier_sku (string or null): model/product code
- description (string): concise description; for table rows, note row-specific details
- raw_attributes (object): other printed values not covered above (e.g. cbm, qty,
  packaging_unit, weight, price_per_meter)
- confidence (number): 0-1, per the rules above

Return ONLY a valid JSON array. No markdown, no explanation.
"""


class ProductAnalyzer:
    def _extract_with_prompt(
        self,
        prompt_template: str,
        text: str,
        tables: list[list[dict]] | None,
        supplier_name: str,
    ) -> list[dict]:
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

        prompt = prompt_template.format(text=combined)
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

    def extract_from_text(
        self,
        text: str,
        tables: list[list[dict]] | None = None,
        supplier_name: str = "",
    ) -> list[dict]:
        """Extract structured product records from raw text + optional tables."""
        return self._extract_with_prompt(TEXT_EXTRACTION_PROMPT, text, tables, supplier_name)

    def extract_from_slide(
        self,
        text: str,
        tables: list[list[dict]] | None = None,
        supplier_name: str = "",
    ) -> list[dict]:
        """Same as extract_from_text but scoped to a single PPTX slide — tuned
        for 'one base product per slide, possibly several size/config variants'."""
        return self._extract_with_prompt(PPTX_SLIDE_EXTRACTION_PROMPT, text, tables, supplier_name)

    def extract_from_image(self, image_path: str, supplier_name: str = "") -> list[dict]:
        """Analyze a product image (photo or spec-sheet table) and return one or more
        extracted product records, using the same field schema as extract_from_text."""
        try:
            response = vision_completion(
                image_path=image_path, prompt=IMAGE_ANALYSIS_PROMPT, max_tokens=4096
            )
            data = json.loads(response.strip())
            if isinstance(data, dict):
                data = [data]
            if not isinstance(data, list):
                return []
            products = [p for p in data if isinstance(p, dict)]
            for p in products:
                if supplier_name and not p.get("supplier_name"):
                    p["supplier_name"] = supplier_name
            return products
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
