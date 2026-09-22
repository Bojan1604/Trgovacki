import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocate, marginPct, markupPct, netFromGross, round, roundAmount,
  roundCash, taxFromGross, taxFromNet,
} from '../src/lib/money';

describe('zaokruživanje', () => {
  it('zaokružuje pola dalje od nule', () => {
    assert.equal(round(2.345, 2), 2.35);
    assert.equal(round(-2.345, 2), -2.35);
    assert.equal(round(2.344, 2), 2.34);
  });

  it('ispravlja binarnu reprezentaciju', () => {
    // 1.005 se u pokretnom zarezu pamti kao 1.00499999999999989
    assert.equal(round(1.005, 2), 1.01);
    assert.equal(roundAmount(0.1 + 0.2), 0.3);
    assert.equal(roundAmount(8.165), 8.17);
  });

  it('vraća nulu za nekonačne vrijednosti', () => {
    assert.equal(round(Number.NaN, 2), 0);
    assert.equal(round(Number.POSITIVE_INFINITY, 2), 0);
  });
});

describe('zaokruživanje gotovine', () => {
  it('zaokružuje na najbližih pet centi', () => {
    assert.equal(roundCash(15.77), 15.75);
    assert.equal(roundCash(15.78), 15.8);
    assert.equal(roundCash(10), 10);
    assert.equal(roundCash(0.02), 0);
  });

  it('poštuje zadani korak', () => {
    assert.equal(roundCash(12.34, 0.1), 12.3);
    assert.equal(roundCash(12.34, 1), 12);
  });
});

describe('porez', () => {
  it('izdvaja PDV iz cijene s porezom', () => {
    assert.equal(taxFromGross(125, 25), 25);
    assert.equal(taxFromGross(10.5, 5), 0.5);
  });

  it('računa PDV na osnovicu', () => {
    assert.equal(taxFromNet(100, 25), 25);
    assert.equal(taxFromNet(100, 13), 13);
  });

  it('izdvajanje i dodavanje poreza su međusobno inverzni', () => {
    const gross = 47.99;
    const net = netFromGross(gross, 25);
    assert.equal(roundAmount(net + taxFromGross(gross, 25)), gross);
  });
});

describe('marža', () => {
  it('računa maržu na prodajnu cijenu', () => {
    assert.equal(marginPct(100, 70), 30);
    assert.equal(marginPct(0, 70), 0);
  });

  it('računa razliku u cijeni na nabavnu', () => {
    assert.equal(markupPct(100, 80), 25);
    assert.equal(markupPct(100, 0), 0);
  });
});

describe('razrez iznosa', () => {
  it('zbroj razreza uvijek jednak ulaznom iznosu', () => {
    const parts = allocate(100, [1, 1, 1]);
    assert.equal(roundAmount(parts.reduce((a, b) => a + b, 0)), 100);
    // Ostatak zaokruživanja ide na jednu stavku, ne gubi se.
    assert.deepEqual(parts.map((p) => roundAmount(p)).sort(), [33.33, 33.33, 33.34]);
  });

  it('razrezuje proporcionalno težinama', () => {
    const parts = allocate(90, [1, 2]);
    assert.deepEqual(parts, [30, 60]);
  });

  it('podnosi nulte težine', () => {
    assert.deepEqual(allocate(50, [0, 0]), [0, 0]);
    assert.deepEqual(allocate(50, []), []);
  });

  it('zadržava točnost na velikom broju stavki', () => {
    const weights = Array.from({ length: 97 }, (_, i) => i + 1);
    const parts = allocate(1234.56, weights);
    assert.equal(roundAmount(parts.reduce((a, b) => a + b, 0)), 1234.56);
  });
});
