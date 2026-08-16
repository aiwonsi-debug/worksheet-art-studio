import sys

src = open("node_modules/pdfjs-dist/legacy/build/pdf.min.mjs").read()
marker = "fake worker failed"
i = src.find(marker)
print("=== context before ===")
print(src[max(0, i - 1600) : i + 200])
