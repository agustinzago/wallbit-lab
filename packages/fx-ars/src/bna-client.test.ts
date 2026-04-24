import { describe, it, expect } from 'vitest';
import { parseBnaHtml } from './bna-client.js';
import { FxSourceError } from './errors.js';

// HTML simulado de la respuesta del BNA — estructura aproximada observada.
const SAMPLE_BNA_HTML = `
<html>
<body>
  <h2>Billetes</h2>
  <table>
    <tr><th>Moneda</th><th>Comprador</th><th>Vendedor</th></tr>
    <tr><td>Dolar U.S.A</td><td>1.200,00</td><td>1.250,00</td></tr>
  </table>
  <h2>Divisas</h2>
  <table>
    <tr><th>Moneda</th><th>Comprador</th><th>Vendedor</th></tr>
    <tr><td>Dolar U.S.A</td><td>1.210,50</td><td>1.260,75</td></tr>
    <tr><td>Euro</td><td>1.300,00</td><td>1.350,00</td></tr>
  </table>
</body>
</html>
`;

const EMPTY_HTML = `<html><body><p>Sin cotizaciones para esta fecha.</p></body></html>`;

describe('parseBnaHtml', () => {
  it('parsea comprador y vendedor desde la sección Divisas', () => {
    const result = parseBnaHtml(SAMPLE_BNA_HTML, '2025-03-15');
    expect(result.comprador).toBe(1210.5);
    expect(result.vendedor).toBe(1260.75);
  });

  it('parsea números con separador de miles (punto) y decimal (coma)', () => {
    const html = `
      <h2>Divisas</h2>
      <table>
        <tr><td>Dolar U.S.A</td><td>1.050,45</td><td>1.100,00</td></tr>
      </table>`;
    const result = parseBnaHtml(html, '2025-06-01');
    expect(result.comprador).toBeCloseTo(1050.45);
    expect(result.vendedor).toBe(1100);
  });

  it('lanza FxSourceError si no hay fila de USD en el HTML', () => {
    expect(() => parseBnaHtml(EMPTY_HTML, '2025-01-01')).toThrow(FxSourceError);
  });

  it('lanza FxSourceError si el HTML tiene la estructura pero sin datos válidos', () => {
    const badHtml = `<h2>Divisas</h2><table><tr><td>Euro</td><td>1.300,00</td><td>1.350,00</td></tr></table>`;
    expect(() => parseBnaHtml(badHtml, '2025-01-01')).toThrow(FxSourceError);
  });
});
