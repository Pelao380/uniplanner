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

// --- Examen y eximición -------------------------------------------------
//
// Con examen, el 100% de las evaluaciones deja de ser el ramo y pasa a ser la
// NOTA DE PRESENTACIÓN. La final combina las dos:
//     final = presentación × (100 − examWeight)% + examen × examWeight%

const conExamen = (weight, eximicion = null) => ({ examWeight: weight, exemptionGrade: eximicion });

describe('summarize — sin examen se comporta igual que antes', () => {
  it('un examen de 0%, nulo o de 100% es como no tener examen', () => {
    const esperado = JSON.stringify(summarize([ev(50, 5.0), ev(50, 3.0)]));
    for (const examen of [undefined, null, {}, conExamen(0), conExamen(null), conExamen(100)]) {
      expect(JSON.stringify(summarize([ev(50, 5.0), ev(50, 3.0)], examen))).toBe(esperado);
    }
  });

  it('sin examen no aparece ninguno de los campos nuevos', () => {
    const s = summarize([ev(100, 5.0)]);
    expect(s.neededInExam).toBeUndefined();
    expect(s.exempt).toBeUndefined();
  });
});

describe('summarize — nota necesaria en el examen', () => {
  it('calcula la nota exacta que falta para llegar a 4.0', () => {
    // Presentación 3.0 con el 60% del peso, examen 40%:
    //   3.0 × 0.6 = 1.8, faltan 2.15 de los 4.0 (menos el redondeo) -> 5.375
    const s = summarize([ev(100, 3.0)], conExamen(40));
    expect(s.presentationGrade).toBe(3.0);
    expect(s.presentationIsFinal).toBe(true);
    expect(s.neededInExam).toBe(5.4); // techo: con 5.3 no alcanza
    expect(s.status).toBe('en-curso');
  });

  it('la nota que promete de verdad alcanza, y una décima menos no', () => {
    for (const [presentacion, peso] of [[3.0, 40], [2.5, 50], [4.0, 30], [1.9, 45]]) {
      const { neededInExam } = summarize([ev(100, presentacion)], conExamen(peso));
      const final = (nota) => presentacion * (1 - peso / 100) + nota * (peso / 100);
      expect(final(neededInExam)).toBeGreaterThanOrEqual(PASSING_GRADE - 0.05);
      expect(final(neededInExam - 0.1)).toBeLessThan(PASSING_GRADE - 0.05);
    }
  });

  it('con la presentación muy baja ni un 7.0 en el examen salva el ramo', () => {
    const s = summarize([ev(100, 1.5)], conExamen(30));
    expect(s.status).toBe('imposible');
    expect(s.neededInExam).toBeNull();
  });

  it('con la presentación alta el examen ya no puede reprobarte', () => {
    const s = summarize([ev(100, 5.5)], conExamen(30));
    expect(s.status).toBe('asegurado');
    expect(s.neededInExam).toBe(MIN_GRADE);
  });

  it('marca la nota como provisional mientras falten evaluaciones', () => {
    const s = summarize([ev(40, 6.0), ev(60)], conExamen(30));
    expect(s.presentationIsFinal).toBe(false);
    expect(s.neededInExamIsProvisional).toBe(true);
    expect(s.neededInExam).not.toBeNull();
    // Nada está decidido todavía, aunque la cuenta de hoy diga "asegurado".
    expect(s.status).toBe('en-curso');
  });

  it('sin ninguna nota todavía no hay nada que proyectar', () => {
    const s = summarize([ev(100)], conExamen(30));
    expect(s.neededInExam).toBeNull();
    expect(s.status).toBe('sin-notas');
  });
});

describe('summarize — eximición', () => {
  it('dice qué nota falta en lo que queda para eximirse', () => {
    // Umbral 5.0 (4.95 real con redondeo), 50% rendido con 5.0:
    //   (4.95×100 − 250) / 50 = 4.9
    const s = summarize([ev(50, 5.0), ev(50)], conExamen(30, 5.0));
    expect(s.neededForExemption).toBe(4.9);
    expect(s.exempt).toBe(false);
  });

  it('la nota que promete para eximirse de verdad exime', () => {
    const s = summarize([ev(50, 5.0), ev(50)], conExamen(30, 5.0));
    const cerrado = summarize([ev(50, 5.0), ev(50, s.neededForExemption)], conExamen(30, 5.0));
    expect(cerrado.exempt).toBe(true);
    expect(cerrado.status).toBe('aprobado');
  });

  it('exime con el redondeo a favor, igual que para aprobar', () => {
    expect(summarize([ev(100, 4.95)], conExamen(30, 5.0)).exempt).toBe(true);
    expect(summarize([ev(100, 4.9)], conExamen(30, 5.0)).exempt).toBe(false);
  });

  it('si eximirse ya es imposible no promete una nota', () => {
    const s = summarize([ev(80, 2.0), ev(20)], conExamen(30, 5.5));
    expect(s.neededForExemption).toBeNull();
    expect(s.exempt).toBe(false);
  });

  it('eximido no rinde examen: la presentación es la nota final', () => {
    const s = summarize([ev(100, 6.0)], conExamen(40, 5.0));
    expect(s.exempt).toBe(true);
    expect(s.neededInExam).toBeNull();
    expect(s.status).toBe('aprobado');
  });

  it('un examen sin nota de eximición lo rinde todo el mundo', () => {
    const s = summarize([ev(100, 6.5)], conExamen(30));
    expect(s.exempt).toBeNull();
    expect(s.neededForExemption).toBeNull();
    expect(s.neededInExam).toBe(MIN_GRADE); // con 6.5 de presentación, ya está
  });

  it('ignora umbrales fuera de la escala', () => {
    expect(summarize([ev(100, 5.0)], conExamen(30, 9.0)).exemptionGrade).toBeNull();
    expect(summarize([ev(100, 5.0)], conExamen(30, 0)).exemptionGrade).toBeNull();
    expect(summarize([ev(100, 5.0)], conExamen(30, MAX_GRADE)).exemptionGrade).toBe(MAX_GRADE);
  });
});
