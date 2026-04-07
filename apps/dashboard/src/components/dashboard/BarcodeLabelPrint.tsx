'use client'
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeLabelProps {
  name: string
  price: number
  sku: string
  barcode: string
}

export function BarcodeLabelPrint({ labels }: { labels: BarcodeLabelProps[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && labels.length > 0) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        labels.forEach((label, i) => {
          const canvas = document.getElementById(`barcode-${i}`) as HTMLCanvasElement
          if (canvas) {
            try {
              JsBarcode(canvas, label.barcode, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 5
              })
            } catch (err) {
              console.error(`Failed to render barcode for ${label.barcode}:`, err)
            }
          }
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [labels])

  return (
    <div ref={containerRef} className="p-4 bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { margin: 0; padding: 0; }
          .label-container { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 10px; 
            padding: 10px;
          }
          .label-card {
            border: 1px solid #eee;
            padding: 10px;
            text-align: center;
            page-break-inside: avoid;
            height: 120px;
            display: flex;
            flex-col: column;
            align-items: center;
            justify-content: center;
          }
          @page { size: A4; margin: 0; }
        }
        .label-container { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
          gap: 10px; 
        }
        .label-card {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: center;
          border-radius: 8px;
          background: white;
        }
        .product-name { font-weight: bold; font-size: 12px; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .product-price { font-size: 11px; color: #555; margin-bottom: 5px; }
        .product-sku { font-size: 9px; color: #999; margin-top: 2px; }
      `}} />
      
      <div className="mb-6 no-print flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
        <div>
          <h2 className="text-lg font-bold text-blue-900">Print Barcode Labels</h2>
          <p className="text-sm text-blue-700">Ready to print {labels.length} labels on A4 grid.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
        >
          Print Now
        </button>
      </div>

      <div className="label-container">
        {labels.map((label, i) => (
          <div key={i} className="label-card">
            <div className="product-name">{label.name}</div>
            <div className="product-price">RM {label.price.toFixed(2)}</div>
            <canvas id={`barcode-${i}`}></canvas>
            <div className="product-sku">{label.sku}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Helper to open the print window with labels.
 */
export function openBarcodePrintWindow(labels: BarcodeLabelProps[]) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  // Basic HTML structure for the new window
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20px; }
          .label-container { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 15px; 
          }
          .label-card {
            border: 1px border #eee;
            padding: 15px;
            text-align: center;
            page-break-inside: avoid;
            border: 1px solid #eee;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .product-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 100%; }
          .product-price { font-size: 12px; margin-bottom: 8px; }
          .product-sku { font-size: 10px; color: #666; margin-top: 4px; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Print Labels</button>
        </div>
        <div class="label-container">
          ${labels.map((l, i) => `
            <div class="label-card">
              <div class="product-name">${l.name}</div>
              <div class="product-price">RM ${l.price.toFixed(2)}</div>
              <svg id="barcode-${i}"></svg>
              <div class="product-sku">${l.sku || ''}</div>
            </div>
          `).join('')}
        </div>
        <script>
          ${labels.map((l, i) => `
            JsBarcode("#barcode-${i}", "${l.barcode}", {
              format: "CODE128",
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 10
            });
          `).join('\n')}
          window.onload = () => {
                   // Optional: auto trigger print
                   // window.print();
          };
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}
