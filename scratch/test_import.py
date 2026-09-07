try:
    import users.urls
    print("Imported successfully!")
except Exception as e:
    print(f"Import failed: {type(e).__name__}: {e}")
