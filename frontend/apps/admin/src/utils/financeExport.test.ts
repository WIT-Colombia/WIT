import test from 'node:test';
import assert from 'node:assert/strict';
import { financeCsv, financeXlsx } from './financeExport.js';
const rows = [{ provider: 'AWS', service: 'EC2', period: '2026-10-01', kind: 'REAL', usd: 1.25, cop: 4125 }];
test('CSV contains headers, values and escaped cells', () => { const csv = financeCsv(rows); assert.match(csv, /"Proveedor","Servicio"/); assert.match(csv, /AWS/); assert.match(csv, /1\.2500/); });
test('XLSX is a ZIP package with workbook and sheet entries', () => { const bytes = financeXlsx(rows); const text = new TextDecoder().decode(bytes); assert.equal(bytes[0], 80); assert.equal(bytes[1], 75); assert.ok(text.includes('xl/workbook.xml')); assert.ok(text.includes('xl/worksheets/sheet1.xml')); });
