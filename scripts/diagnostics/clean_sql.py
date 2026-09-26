import os

# Function to remove BOM from a file
def remove_bom(input_file, output_file):
    with open(input_file, 'rb') as f:
        content = f.read()
    
    # Check for UTF-8 BOM
    if content.startswith(b'\xef\xbb\xbf'):
        content = content[3:]
    # Check for UTF-16 BE BOM
    elif content.startswith(b'\xfe\xff'):
        content = content[2:]
    # Check for UTF-16 LE BOM
    elif content.startswith(b'\xff\xfe'):
        content = content[2:]
        
    with open(output_file, 'wb') as f:
        f.write(content)
    print(f"BOM removed from {input_file} and saved to {output_file}")

remove_bom('local_db_plain.sql', 'local_db_clean.sql')
