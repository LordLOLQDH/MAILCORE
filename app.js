let lastData = null;

function parseOffer() {
  const text = document.getElementById("input").value.toLowerCase();

  let items = [];

  // Wände
  const wand = text.match(/(\d+)\s?(qm|m2|m²)?\s?wände?/);
  if (wand) {
    const qm = parseInt(wand[1]);
    items.push({
      title: "Wände streichen",
      qm,
      price: 12,
      total: qm * 12
    });
  }

  // Decke
  const decke = text.match(/(\d+)\s?(qm|m2|m²)?\s?decke/);
  if (decke) {
    const qm = parseInt(decke[1]);
    items.push({
      title: "Decke streichen",
      qm,
      price: 14,
      total: qm * 14
    });
  }

  // Boden
  const boden = text.match(/(\d+)\s?(qm|m2|m²)?\s?boden/);
  if (boden) {
    const qm = parseInt(boden[1]);
    items.push({
      title: "Bodenarbeiten",
      qm,
      price: 20,
      total: qm * 20
    });
  }

  if (items.length === 0) {
    document.getElementById("output").innerHTML =
      "Keine Leistung erkannt.";
    return;
  }

  const net = items.reduce((a,b)=>a+b.total,0);
  const tax = net * 0.19;

  lastData = { items, net, tax };

  render(items, net, tax);
}

function render(items, net, tax) {
  let html = "";

  items.forEach(i => {
    html += `
      <div class="row">
        ${i.title}: ${i.qm} qm → ${i.total} €
      </div>
    `;
  });

  html += `
    <hr>
    <p>Netto: ${net} €</p>
    <p>MwSt: ${tax.toFixed(2)} €</p>
    <h3>Brutto: ${(net+tax).toFixed(2)} €</h3>
  `;

  document.getElementById("output").innerHTML = html;
  document.getElementById("pdfBtn").style.display = "block";
}
