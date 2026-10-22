# BANCO DE PRUEBAS — pasa el Excel del Sheet a datos/sheet.json
# Uso:  python3 banco-pruebas/excel-a-json.py <ruta del Excel .xlsx>
# El Excel se baja del Sheet de produccion (Drive de Guille, exportado como .xlsx,
# con los valores de las formulas). Se guarda en banco-pruebas/datos/, que NO se
# sube a GitHub (lleva nombres y telefonos de vecinos; ver .gitignore de esta carpeta).
import datetime, json, os, sys
import openpyxl

if len(sys.argv) < 2:
    sys.exit("Uso: python3 excel-a-json.py <Excel.xlsx>")
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)

def f(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d") if (v.hour, v.minute, v.second) == (0, 0, 0) else v.isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)

out = {}
for ws in wb.worksheets:
    rows = [[f(c) for c in r] for r in ws.iter_rows(values_only=True)]
    while rows and not any(rows[-1]):
        rows.pop()
    out[ws.title] = [r[: max([i + 1 for i, x in enumerate(r) if x] + [0])] for r in rows]

dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "datos")
os.makedirs(dest, exist_ok=True)
with open(os.path.join(dest, "sheet.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False)
print("datos/sheet.json:", len(out), "pestañas,", sum(len(v) for v in out.values()), "filas")
