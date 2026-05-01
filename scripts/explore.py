import pdfplumber

PDF = '/Users/fabs/Downloads/catalogo-20260430 (1).pdf'

with pdfplumber.open(PDF) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    p1 = pdf.pages[0]
    tables = p1.extract_tables()
    print(f"Tables on page 1: {len(tables)}")
    if tables:
        t = tables[0]
        print(f"Rows: {len(t)}")
        print("First 3 rows:")
        for row in t[:3]:
            print(row)
        print("---")
        print("Sample data row (row 5):")
        if len(t) > 5:
            print(t[5])
