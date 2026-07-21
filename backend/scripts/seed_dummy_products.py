"""
One-off demo seeder — turns the images in pics/dummy/ into fake Product
records (with real text + image embeddings) so search/browsing can be
demoed without waiting on the full parse -> LLM -> embed pipeline.

Run from backend/ with the venv active:
    python scripts/seed_dummy_products.py
"""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.core.database import SessionLocal, create_all_tables
from app.db.models import Document, MediaAsset, Product, ProductImage
from app.services.ai.embeddings.image_embedding import ImageEmbeddingService
from app.services.ai.embeddings.text_embedding import TextEmbeddingService
from app.services.ingestion.deduplication import compute_bytes_hash, compute_perceptual_hash
from app.services.ingestion.image_extractor import get_image_metadata

DEMO_PRODUCTS = [
    {"title": "Milano 3-Seater Sofa", "category": "sofa", "material": "Fabric", "color": "Charcoal Grey", "price": 899.0},
    {"title": "Nordic Lounge Sofa", "category": "sofa", "material": "Linen", "color": "Beige", "price": 1049.0},
    {"title": "Verona Armchair", "category": "chair", "material": "Velvet", "color": "Emerald Green", "price": 349.0},
    {"title": "Oslo Dining Chair", "category": "chair", "material": "Oak / Fabric", "color": "Natural Wood", "price": 129.0},
    {"title": "Carrara Coffee Table", "category": "table", "material": "Marble / Steel", "color": "White", "price": 429.0},
    {"title": "Denver Dining Table", "category": "table", "material": "Solid Oak", "color": "Walnut", "price": 799.0},
    {"title": "Aspen Bed Frame", "category": "bed", "material": "Upholstered Fabric", "color": "Slate Blue", "price": 649.0},
    {"title": "Kyoto Platform Bed", "category": "bed", "material": "Bamboo", "color": "Natural", "price": 599.0},
    {"title": "Brooklyn Wardrobe", "category": "wardrobe", "material": "MDF / Oak Veneer", "color": "White Oak", "price": 749.0},
    {"title": "Helsinki 2-Door Wardrobe", "category": "wardrobe", "material": "Melamine", "color": "Grey", "price": 529.0},
    {"title": "Soho Media Cabinet", "category": "cabinet", "material": "Engineered Wood", "color": "Black Oak", "price": 389.0},
    {"title": "Copenhagen Sideboard", "category": "cabinet", "material": "Walnut Veneer", "color": "Walnut", "price": 459.0},
    {"title": "Berlin Writing Desk", "category": "desk", "material": "Steel / Oak", "color": "Black / Natural", "price": 299.0},
    {"title": "Minimalist Corner Desk", "category": "desk", "material": "MDF", "color": "White", "price": 219.0},
    {"title": "Floating Wall Shelf Set", "category": "shelf", "material": "Solid Pine", "color": "Natural", "price": 89.0},
    {"title": "Ladder Bookshelf", "category": "shelf", "material": "Metal / Wood", "color": "Black", "price": 179.0},
    {"title": "Arc Floor Lamp", "category": "lamp", "material": "Marble Base / Metal", "color": "Brass", "price": 159.0},
]


def main():
    create_all_tables()
    db = SessionLocal()

    dummy_dir = Path(settings.PICS_DIR) / "dummy"
    image_paths = sorted(
        p for p in dummy_dir.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )
    if not image_paths:
        print(f"No images found in {dummy_dir}")
        return

    doc = Document(
        filename="dummy-demo-catalog",
        file_type="image",
        supplier_name="Demo Supplier",
        status="done",
        content_hash=f"dummy-seed-{len(image_paths)}",
    )
    db.add(doc)
    db.flush()

    # Files are served from pics/{document_id}/{filename} (see files.py) — copy the
    # dummy images into that layout rather than referencing pics/dummy/ directly.
    doc_dir = Path(settings.PICS_DIR) / doc.id
    doc_dir.mkdir(parents=True, exist_ok=True)

    text_embed = TextEmbeddingService()
    image_embed = ImageEmbeddingService()

    created = 0
    for i, img_path in enumerate(image_paths):
        pdata = DEMO_PRODUCTS[i % len(DEMO_PRODUCTS)]

        dest_path = doc_dir / img_path.name
        shutil.copy2(img_path, dest_path)

        meta = get_image_metadata(str(dest_path))
        with open(dest_path, "rb") as f:
            sha256 = compute_bytes_hash(f.read())

        asset = MediaAsset(
            document_id=doc.id,
            source_type="demo",
            source_ref=f"dummy_{i}",
            local_path=str(dest_path),
            filename=dest_path.name,
            sha256=sha256,
            phash=compute_perceptual_hash(str(dest_path)),
            width=meta.get("width"),
            height=meta.get("height"),
            mime_type=meta.get("mime_type"),
        )
        db.add(asset)
        db.flush()

        product = Product(
            document_id=doc.id,
            title=pdata["title"],
            category=pdata["category"],
            material=pdata["material"],
            color=pdata["color"],
            price=pdata["price"],
            currency="USD",
            supplier_name="Demo Supplier",
            description=f"{pdata['title']} — {pdata['material']}, {pdata['color']}.",
            source_confidence=1.0,
        )
        db.add(product)
        db.flush()

        db.add(ProductImage(product_id=product.id, media_asset_id=asset.id, role="hero", rank=0))

        text_for_embed = " ".join([product.title, product.category, product.material, product.color, product.description])
        text_embed.upsert(entity_id=product.id, text=text_for_embed)
        image_embed.upsert(asset_id=asset.id, image_path=str(dest_path))

        created += 1
        print(f"[{created}/{len(image_paths)}] Created product '{product.title}' ({img_path.name})")

    doc_id = doc.id
    db.commit()
    db.close()
    print(f"\nDone. Seeded {created} demo products under document {doc_id}.")


if __name__ == "__main__":
    main()
