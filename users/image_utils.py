import os
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile

def resize_image(image_field, size=(800, 800), quality=85):
    """
    Resizes an image to fit within the specified size while maintaining aspect ratio.
    Saves it back to the field.
    """
    if not image_field:
        return

    try:
        img = Image.open(image_field)

        # Skip if already small
        if img.width <= size[0] and img.height <= size[1]:
            return

        img.thumbnail(size, Image.Resampling.LANCZOS)

        # Save to buffer
        temp_handle = BytesIO()
        # Preserve format or use JPEG for efficiency
        fmt = img.format if img.format else 'JPEG'
        if fmt == 'PNG':
             img.save(temp_handle, format='PNG', optimize=True)
        else:
             if img.mode in ("RGBA", "P"):
                 img = img.convert("RGB")
             img.save(temp_handle, format='JPEG', quality=quality, optimize=True)

        temp_handle.seek(0)

        # Update the field
        filename = os.path.basename(image_field.name)
        image_field.save(filename, ContentFile(temp_handle.read()), save=False)

    except Exception as e:
        print(f"Error resizing image: {e}")

def create_thumbnail(image_field, size=(150, 150)):
    """
    Creates a small thumbnail for the given image.
    This doesn't return a field, but a ContentFile that can be saved to a separate field.
    """
    if not image_field:
        return None

    try:
        img = Image.open(image_field)
        img.thumbnail(size, Image.Resampling.LANCZOS)

        temp_handle = BytesIO()
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(temp_handle, format='JPEG', quality=75, optimize=True)
        temp_handle.seek(0)

        return ContentFile(temp_handle.read())
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return None
