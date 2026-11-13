import { describe, it, expect } from 'vitest';
import { summarize, PASSING_GRADE, MIN_GRADE, MAX_GRADE } from './grades.js';

const ev = (weight, grade = null) => ({ weight, grade });

describe('summarize — promedio ponderado', () => {
  it('promedia sobre el peso ya rendido, no sobre 100', () => {
    const s = summarize([ev(30, 3.5), ev(30, 5.0), ev(40)]);
    expect(s.currentAverage).toBe(4.3); // 255/60 = 4.25 -> 4.3
    expect(s.gradedWeight).toBe(60);
    expect(s.remainingWeight).toBe(40);
  });

  it('sin notas devuelve promedio nulo', () => {
    const s = summarize([ev(50), ev(50)]);
    expect(s.currentAverage).toBeNull();
    expect(s.status).toBe('sin-notas');
  });

  it('un ramo vacío no revienta', () => {
    const s = summarize([]);
    expect(s.currentAverage).toBeNull();
    expect(s.totalWeight).toBe(0);
    expect(s.status).toBe('sin-notas');
  });
});

describe('summarize — ponderaciones incompletas', () => {
  it('trata el hueco no declarado como pendiente', () => {
    // 60% declarado y rendido: el 40% que falta todavía no se carga,
    // pero existe, porque las ponderaciones suman 100 por definición.
    const s = summarize([ev(30, 3.5), ev(30, 5.0)]);
    expect(s.totalWeight).toBe(60);
    expect(s.remainingWeight).toBe(40);
    expect(s.status).toBe('en-curso');
  });

  it('resuelve el ramo cuando ni el hueco completo alcanza', () => {
    // Regresión: antes pedía un 13.0, fuera de la escala 1.0–7.0.
    // Con 3.0 en el 90%, ni un 7.0 en el 10% restante llega a 4.0.
    const s = summarize([ev(30, 3.0), ev(30, 3.0), ev(30, 3.0)]);
    expect(s.status).toBe('imposible');
    expect(s.neededToPass).toBeNull();
  });
});

describe('summarize — cierre del ramo', () => {
  it('cierra con el 100% rendido', () => {
    expect(summarize([ev(50, 6.0), ev(50, 6.0)]).status).toBe('aprobado');
    expect(summarize([ev(50, 2.0), ev(50, 2.0)]).status).toBe('reprobado');
  });

  it('un 3.95 final aprueba porque la nota se informa redondeada', () => {
    const s = summarize([ev(30, 3.5), ev(30, 5.0), ev(40, 3.5)]);
    expect(s.currentAverage).toBe(4.0); // 3.95 -> 4.0
    expect(s.status).toBe('aprobado');
  });
});

describe('summarize — nota necesaria', () => {
  it('redondea hacia arriba para no prometer de menos', () => {
    const s = summarize([ev(30, 3.5), ev(30, 5.0), ev(40)]);
    expect(s.neededToPass).toBe(3.5); // (395 - 255) / 40 = 3.5
  });

  it('marca imposible cuando ni un 7.0 alcanza', () => {
    const s = summarize([ev(80, 1.0), ev(20)]);
    expect(s.status).toBe('imposible');
    expect(s.neededToPass).toBeNull();
  });

  it('marca asegurado cuando ya aprobó pase lo que pase', () => {
    const s = summarize([ev(80, 7.0), ev(20)]);
    expect(s.status).toBe('asegurado');
    expect(s.neededToPass).toBe(MIN_GRADE);
  });

  it('nunca devuelve una nota fuera de la escala 1.0–7.0', () => {
    for (let w = 10; w <= 90; w += 10) {
      for (let g = 1; g <= 7; g += 0.5) {
        const { neededToPass } = summarize([ev(w, g), ev(100 - w)]);
        if (neededToPass !== null) {
          expect(neededToPass).toBeGreaterThanOrEqual(MIN_GRADE);
          expect(neededToPass).toBeLessThanOrEqual(MAX_GRADE);
        }
      }
    }
  });

  it('no arrastra errores de punto flotante', () => {
    const { neededToPass } = summarize([ev(10, 1.1), ev(10, 2.2), ev(80)]);
    expect(Number.isInteger(Math.round(neededToPass * 10))).toBe(true);
    expect(neededToPass).toBe(Math.round(neededToPass * 10) / 10);
  });
});

describe('propiedad: sacar exactamente neededToPass alcanza para aprobar', () => {
  // Esta es la prueba que habría cazado el bug del redondeo.
  const escenarios = [
    [ev(30, 3.5), ev(30, 5.0), ev(40)],
    [ev(25, 4.0), ev(25, 3.0), ev(50)],
    [ev(60, 3.9), ev(40)],
    [ev(45, 5.5), ev(55)],
    [ev(30, 2.0), ev(30, 6.0), ev(40)],
    [ev(33.33, 4.1), ev(33.33, 3.2), ev(33.34)],
  ];

  it.each(escenarios)('escenario %#', (...evaluaciones) => {
    const { neededToPass, status } = summarize(evaluaciones);
    if (status === 'imposible') return;
    expect(neededToPass).not.toBeNull();

    // Rellenamos lo pendiente con exactamente la nota que la app prometió.
    const cerrado = evaluaciones.map((e) =>
      e.grade === null ? { ...e, grade: neededToPass } : e
    );
    const final = summarize(cerrado);
    expect(final.remainingWeight).toBe(0);
    expect(final.status).toBe('aprobado');
    expect(final.currentAverage).toBeGreaterThanOrEqual(PASSING_GRADE);
  });

  it('y sacar una décima menos NO alcanza', () => {
    const evaluaciones = [ev(30, 3.5), ev(30, 5.0), ev(40)];
    const { neededToPass } = summarize(evaluaciones);
    const justoAbajo = evaluaciones.map((e) =>
      e.grade === null ? { ...e, grade: Math.max(neededToPass - 0.1, MIN_GRADE) } : e
    );
    expect(summarize(justoAbajo).status).toBe('reprobado');
  });
});

describe('summarize — datos inválidos que ya existan en la base', () => {
  it('no explota si las ponderaciones suman más de 100', () => {
    const s = summarize([ev(60, 2.0), ev(60, 2.0)]);
    expect(s.totalWeight).toBe(120);
    expect(s.remainingWeight).toBe(0);
    expect(s.status).toBe('reprobado');
  });

  it('acepta notas que llegan como string desde Postgres', () => {
    const s = summarize([{ weight: '30.00', grade: '3.5' }, { weight: '70.00', grade: '5.0' }]);
    expect(s.currentAverage).toBe(4.6);
    expect(s.status).toBe('aprobado');
  });
});
