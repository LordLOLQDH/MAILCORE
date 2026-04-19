function downloadPDF() {
  const win = window.open("", "", "width=900,height=600");

  let rows = "";

  lastData.items.forEach(i => {
    rows += `
      <tr>
        <td>${i.title}</td>
        <td>${i.qm} qm</td>
        <td>${i.total} €</td>
      </tr>
    `;
  });

  win.document.write(`
    <html>
    <head>
      <title>Malifix Angebot</title>
      <style>
        body { font-family: Arial; padding: 40px; }
        h1 { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #ddd; padding: 10px; }
      </style>
    </head>
    <body>
      <h1>Malifix Angebot</h1>

      <table>
        <tr><th>Leistung</th><th>Menge</th><th>Preis</th></tr>
        ${rows}
      </table>

      <h3>Gesamt: ${lastData.net + lastData.tax} €</h3>

      <script>window.print()</script>
    </body>
    </html>
  `);

  win.document.close();
}
