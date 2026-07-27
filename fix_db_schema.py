import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def fix_schema():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user_table = User._meta.db_table

    print(f"--- DB SCHEMA FIX START ---")
    print(f"Connected to Database: {connection.settings_dict['NAME']}")
    print(f"User Table Name: {user_table}")

    with connection.cursor() as cursor:
        # Check if table exists
        cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'academics_studentprofile');")
        if not cursor.fetchone()[0]:
            print("ERROR: Table academics_studentprofile does not exist!")
            return

        columns_to_ensure = [
            ('father_id', 'integer'),
            ('mother_id', 'integer'),
            ('birth_date', 'date'),
            ('father_name', 'varchar(255)'),
            ('mother_name', 'varchar(255)'),
            ('guardian_name', 'varchar(255)'),
        ]

        for col_name, col_type in columns_to_ensure:
            try:
                cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='academics_studentprofile' AND column_name='{col_name}';")
                if not cursor.fetchone():
                    print(f"CRITICAL: Adding missing column '{col_name}' to database...")
                    cursor.execute(f"ALTER TABLE academics_studentprofile ADD COLUMN {col_name} {col_type} NULL;")
                    # Add FK constraint for link columns
                    if '_id' in col_name:
                         try:
                             # Use detected user_table instead of hardcoded auth_user
                             cursor.execute(f"ALTER TABLE academics_studentprofile ADD CONSTRAINT fk_sp_{col_name} FOREIGN KEY ({col_name}) REFERENCES {user_table}(id) ON DELETE SET NULL;")
                             print(f"   - Foreign Key constraint added for {col_name} pointing to {user_table}")
                         except Exception as fk_err:
                             print(f"   - FK Warning: {fk_err}")
                else:
                    print(f"Column '{col_name}' already exists.")
            except Exception as e:
                print(f"Failed to ensure column {col_name}: {e}")

        # Clear ALL migration history to force sync and fix dependency order
        print("\nClearing ALL migration history to fix inconsistencies...")
        try:
            cursor.execute("TRUNCATE django_migrations CASCADE;")
            print("Migration history table truncated (CASCADE) successfully.")
        except Exception as e:
            print(f"Error truncating table: {e}")
            cursor.execute("DELETE FROM django_migrations;")
            print("Migration history deleted via fallback.")

    print(f"--- DB SCHEMA FIX COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    fix_schema()
