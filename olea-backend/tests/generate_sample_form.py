"""
Generate a sample paper form image for testing the OCR pipeline.

Creates a clean image with the format:
    Field Name: value
    ...

Usage:
    python -m tests.generate_sample_form
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Sample data matching the dataset columns
SAMPLE_FORM_DATA = {
    "Adult Dependents": "2",
    "Child Dependents": "1",
    "Infant Dependents": "0",
    "Estimated Annual Income": "65,000",
    "Employment Status": "Employed",
    "Region Code": "R-105",
    "Existing Policyholder": "Yes",
    "Previous Claims Filed": "1",
    "Years Without Claims": "4",
    "Previous Policy Duration Months": "36",
    "Policy Cancelled Post Purchase": "No",
    "Deductible Tier": "Medium",
    "Payment Schedule": "Monthly",
    "Vehicles on Policy": "2",
    "Custom Riders Requested": "1",
    "Grace Period Extensions": "0",
    "Days Since Quote": "12",
    "Underwriting Processing Days": "5",
    "Policy Amendments Count": "2",
    "Acquisition Channel": "Online",
    "Broker Agency Type": "Medium",
    "Broker ID": "BRK-4421",
    "Employer ID": "EMP-8832",
    "Policy Start Year": "2026",
    "Policy Start Month": "March",
    "Policy Start Week": "10",
    "Policy Start Day": "15",
}

# A second form with some fields empty (simulates partially filled form)
PARTIAL_FORM_DATA = {
    "Adult Dependents": "3",
    "Child Dependents": "2",
    "Infant Dependents": "......",
    "Estimated Annual Income": "92000",
    "Employment Status": "Self-Employed",
    "Region Code": "......",
    "Existing Policyholder": "No",
    "Previous Claims Filed": "0",
    "Years Without Claims": "7",
    "Previous Policy Duration Months": "......",
    "Policy Cancelled Post Purchase": "No",
    "Deductible Tier": "High",
    "Payment Schedule": "Annual",
    "Vehicles on Policy": "1",
    "Custom Riders Requested": "......",
    "Grace Period Extensions": "......",
    "Days Since Quote": "3",
    "Underwriting Processing Days": "......",
    "Policy Amendments Count": "0",
    "Acquisition Channel": "Agent",
    "Broker Agency Type": "......",
}


def generate_form_image(
    data: dict[str, str],
    output_path: str,
    title: str = "INSURANCE APPLICATION FORM",
) -> str:
    """
    Generate a paper-form-style image.

    Args:
        data: Dict of field label → value.
        output_path: Where to save the image.
        title: Form title.

    Returns:
        Path to the generated image.
    """
    # Layout
    width = 800
    line_height = 36
    margin_x = 50
    margin_y = 80
    height = margin_y + (len(data) + 4) * line_height + 60

    # Create white image
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    # Try to use a monospace font, fall back to default
    try:
        font = ImageFont.truetype("cour.ttf", 18)
        title_font = ImageFont.truetype("courbd.ttf", 24)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("DejaVuSansMono.ttf", 18)
            title_font = ImageFont.truetype("DejaVuSansMono-Bold.ttf", 24)
        except (OSError, IOError):
            font = ImageFont.load_default()
            title_font = font

    y = margin_y

    # Title
    draw.text((margin_x, y - 50), title, fill="black", font=title_font)
    draw.line([(margin_x, y - 20), (width - margin_x, y - 20)], fill="black", width=2)
    y += 10

    # Fields
    for label, value in data.items():
        line = f"{label}: {value}"
        draw.text((margin_x, y), line, fill="black", font=font)
        y += line_height

    # Bottom line
    y += 20
    draw.line([(margin_x, y), (width - margin_x, y)], fill="black", width=2)
    draw.text((margin_x, y + 10), "Signature: ________________", fill="gray", font=font)

    # Save
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated form image: {output_path}")
    return output_path


if __name__ == "__main__":
    output_dir = os.path.join(os.path.dirname(__file__), "fixtures")
    os.makedirs(output_dir, exist_ok=True)

    generate_form_image(
        SAMPLE_FORM_DATA,
        os.path.join(output_dir, "sample_form_full.png"),
        title="INSURANCE APPLICATION — FULL",
    )

    generate_form_image(
        PARTIAL_FORM_DATA,
        os.path.join(output_dir, "sample_form_partial.png"),
        title="INSURANCE APPLICATION — PARTIAL",
    )

    print("Done! Sample forms generated in tests/fixtures/")
