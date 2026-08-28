/**
 * Spanish copy. Same rule as `en.ts`: written for the person who runs the
 * business, not for the person who built the pipeline.
 *
 * Neutral Latin-American Spanish, addressing the reader as "usted" implicitly
 * (impersonal where possible) — this is an operator tool used across Miami,
 * so it should not read as translated-from-English English.
 *
 * `Dictionary` makes every key here mandatory: a missing translation is a
 * type error at build time, never a silent English string in a Spanish UI.
 */

import type { Dictionary } from "./en";

export const es: Dictionary = {
  brand: {
    product: "OpenCube Intel",
    tagline: "Inteligencia de mercado que puede comprobar",
    logoAlt: "OpenCube Studio",
  },

  nav: {
    overview: "Centro de mando",
    runs: "Análisis",
    tasks: "Tareas",
    team: "Equipo",
    matches: "Oportunidades",
    businesses: "Negocios",
    catalog: "Qué buscamos",
    skipToContent: "Ir al contenido",
    primary: "Navegación principal",
    open: "Abrir menú",
    close: "Cerrar menú",
    breadcrumb: "Ubicación actual",
    workspace: "Mercado actual",
    language: "Idioma",
    languageEnglish: "English",
    languageSpanish: "Español",
    evidenceBadge: "Cada afirmación tiene su fuente",
  },

  common: {
    retry: "Reintentar",
    all: "Todo",
    of: "de",
    none: "Ninguno",
    notAvailable: "—",
    loading: "Cargando",
    updated: "Actualizado {time}",
    refreshing: "Actualizando…",
    openRun: "Abrir análisis",
    viewAll: "Ver todo",
    visitSite: "Ver sitio",
    openListing: "Ver en el mapa",
    noWebsite: "Sin sitio web",
    noWebsiteHelp:
      "No encontramos un sitio web para este negocio. Eso también es algo que podemos observar.",
    business: "Negocio",
    opportunity: "Oportunidad",
    run: "Análisis",
    startedRelative: "empezó {time}",
    collectedBy: "encontrado por",
    sourceType: "Fuente",
  },

  status: {
    finding: {
        CONFIRMED: {
        label: "Confirmado",
        meaning: "Vimos señales reales de esto en las páginas públicas del negocio.",
      },
      CONTRADICTED: {
        label: "Descartado",
        meaning: "Encontramos lo contrario: este negocio ya lo tiene resuelto.",
      },
      INSUFFICIENT_EVIDENCE: {
        label: "No pudimos saberlo",
        meaning:
          "Nada público lo aclaró. Eso no es un «no»: solo significa que no pudimos verlo.",
      },
      UNVERIFIED: {
        label: "Aún sin revisar",
        meaning: "Todavía no hemos evaluado este caso.",
      },
    },

    secondOpinion: {
        SUPPORTS: {
        label: "Coincide",
        meaning: "Una fuente externa dijo lo mismo que nosotros.",
      },
      CONTRADICTS: {
        label: "Contradice",
        meaning: "Una fuente externa dijo lo contrario de lo que encontramos.",
      },
      INSUFFICIENT_EVIDENCE: {
        label: "No lo aclaró",
        meaning: "Leímos fuentes externas, pero no respondieron la pregunta.",
      },
      NO_INDEPENDENT_SOURCE: {
        label: "Sin fuente externa",
        meaning:
          "No encontramos a nadie independiente del negocio que hablara de esto. Lo registramos como un hecho aparte, no como un «no».",
      },
      FAILED: {
        label: "La revisión falló",
        meaning:
          "La segunda opinión tuvo un problema técnico. Eso es distinto de no encontrar respuesta.",
      },
      IN_PROGRESS: {
        label: "Revisando",
        meaning: "La segunda opinión todavía está en curso.",
      },
      NONE: {
        label: "Sin revisar",
        meaning: "No pedimos una segunda opinión en este caso.",
      },
      UNKNOWN: {
        label: "Registro poco claro",
        meaning:
          "Este registro no coincide con ningún estado conocido, así que no lo forzamos a ninguno.",
      },
    },

    fit: {
        MATCHED: {
        label: "Encaja",
        meaning:
          "La evidencia respalda un problema que uno de nuestros servicios resuelve. Esto no autoriza a contactarlos: eso lo decide una persona.",
      },
      NOT_MATCHED: {
        label: "No encaja",
        meaning:
          "Lo revisamos y decidimos que no. O el negocio ya lo tiene resuelto, o la evidencia no lo respaldaba.",
      },
      UNRESOLVED: {
        label: "Requiere una persona",
        meaning:
          "Nuestra investigación y la fuente externa no coinciden, o la evidencia nunca fue suficiente. Alguien debería revisarlo.",
      },
    },

    run: {
      CREATED: { label: "Creado", meaning: "Guardado, todavía sin empezar." },
      QUEUED: { label: "En cola", meaning: "Aceptado y esperando para empezar." },
      DISCOVERING: {
        label: "Buscando negocios",
        meaning: "Buscando en el mercado los negocios que vamos a revisar.",
      },
      INVESTIGATING: {
        label: "Investigando",
        meaning: "Leyendo las páginas públicas de cada negocio y anotando lo que vemos.",
      },
      FINALIZING: {
        label: "Revisando y evaluando",
        meaning: "Pidiendo segundas opiniones y viendo dónde podemos ayudar.",
      },
      IN_PROGRESS: { label: "En curso", meaning: "En proceso." },
      COMPLETED: {
        label: "Terminado",
        meaning: "Se investigaron todos los negocios y el análisis terminó sin errores.",
      },
      FAILED: {
        label: "Terminó con errores",
        meaning:
          "Al menos un negocio no se pudo investigar. Todo lo demás sí produjo resultados reales.",
      },
    },

    research: {
      IN_PROGRESS: { label: "Investigando", meaning: "Todavía trabajando en este negocio." },
      COMPLETED: { label: "Listo", meaning: "Terminado correctamente." },
      FAILED: { label: "Falló", meaning: "No pudimos terminar este caso." },
    },

    evidence: {
      SUPPORTING: {
        label: "Lo respalda",
        meaning: "Lo citamos como razón para creer que la oportunidad es real.",
      },
      CONTRADICTING: {
        label: "Lo contradice",
        meaning: "Lo citamos como razón para creer que no lo es.",
      },
      INDEPENDENT: {
        label: "Fuente externa",
        meaning: "Encontrado en un sitio que el negocio no controla.",
      },
    },
  },

  judge: {
    badge: "Modo Jurado · solo lectura",
    title: "Datos de producción reales · Modo Jurado de solo lectura",
    body:
      "Esta demo pública muestra tareas de producción reales ya completadas. La ejecución de tareas nuevas está desactivada aquí para evitar el consumo anónimo de recursos de IA y de nube de pago.",
  },

  conservative: {
    title: "La mayoría de los motivos para contactar no se sostuvieron",
    headline: "Descartamos {rejected} de {total} posibles razones para contactar.",
    principle:
      "OpenCube está diseñado para detener contactos sin respaldo, no para inventar motivos para contactar.",
    evaluated: "motivos evaluados",
    rejected: "descartados",
    worthExploring: "vale la pena explorar",
    needsReview: "requieren revisión",
    short: "{rejected} de {total} descartados",
  },

  action: {
    MATCHED: {
      label: "Vale la pena explorarla",
      detail: "Aún requiere aprobación humana antes de contactar a nadie.",
    },
    NOT_MATCHED: {
      label: "No contactar por este motivo",
      detail:
        "Esto se refiere solo a este motivo, no al negocio. Otro motivo podría seguir en pie.",
    },
    UNRESOLVED: {
      label: "No contactar todavía",
      detail: "Requiere revisión humana: la evidencia se contradice.",
    },
  },

  chain: {
    title: "Cómo llegamos a esto",
    subtitle:
      "Toda la cadena, en orden: qué vimos, qué podría significar, qué dijo la evidencia y qué concluimos.",
    observation: "Qué vimos",
    observationHelp:
      "Registrado de las páginas públicas del propio negocio, con enlace a dónde lo vimos.",
    problem: "Qué podría significar",
    problemHelp: "Lo que el investigador pensó que la observación podía indicar.",
    check: "Qué dijo la evidencia",
    checkHelp: "Si la evidencia lo respaldó, lo contradijo o no aclaró nada.",
    decision: "Qué concluimos",
    action: "Qué pasa ahora",
    firstParty: "Fuentes públicas del propio negocio",
    firstPartyHelp: "Páginas que el negocio controla.",
    outside: "Fuentes externas independientes",
    outsideHelp: "Sitios que el negocio no controla.",
    noFirstParty:
      "No pudimos obtener evidencia pública del sitio propio de este negocio.",
    noFirstPartyWithOutside:
      "No pudimos obtener evidencia pública del sitio propio de este negocio. Las fuentes externas se revisaron por separado.",
    noOutside: "No se leyó ninguna fuente externa en este caso.",
  },

  commandCenter: {
    heroEyebrow: "OpenCube Intel",
    heroTitle: "Tu equipo de operaciones con IA",
    heroSubtitle:
      "Dile a tu equipo qué investigar. Encuentran los negocios, leen lo que es público, contrastan los hallazgos importantes en otro lado y vuelven con lo que pueden demostrar.",
    heroAction: "Nueva tarea",
    heroSteps: {
      task: "Tú defines la tarea",
      team: "Tu equipo trabaja",
      result: "Recibes evidencia",
    },
    activeTitle: "Trabajando ahora",
    activeSubtitle: "Puedes cerrar esta página: el trabajo continúa.",
    recentTitle: "Tareas recientes",
    recentSubtitle: "Lo último que terminó tu equipo.",
    snapshotEyebrow: "Contexto",
    snapshotTitle: "Todo hasta ahora",
    snapshotExcluded:
      "{count} tarea no produjo resultados, así que no se cuenta aquí.",
    snapshotExcludedPlural:
      "{count} tareas no produjeron resultados, así que no se cuentan aquí.",
    snapshotSubtitle:
      "Totales de todas las tareas de este mercado. Cada número viene de algo que realmente vimos y guardamos.",
  },

  productLabels: {
    opportunities: {
      online_booking_friction: "Difícil reservar en línea",
      after_hours_lead_intake: "No hay forma de contactarlos fuera de horario",
      lead_follow_up_effectiveness: "Tardan en dar seguimiento a las consultas",
      pbx_telephony_cost_optimization: "La telefonía cuesta más de lo necesario",
      crm_optimization_or_replacement: "Los registros de clientes necesitan mejores herramientas",
    },
    capabilities: {
      ai_lead_intake_qualification: "Recepción de consultas con IA",
      ai_appointment_booking_assistance: "Asistente de reservas con IA",
      ai_voice_reception_telephone_agent: "Recepción telefónica con IA",
      missed_call_after_hours_lead_recovery: "Recuperación de llamadas perdidas y fuera de horario",
      automated_lead_follow_up: "Seguimiento automático",
      ai_client_concierge_faq: "Conserje de clientes con IA",
      crm: "Registros de clientes (CRM)",
      cloud_pbx_business_telephony: "Central telefónica en la nube",
      workflow_automation_integrations: "Automatización de procesos",
      website_landing_page_conversion: "Sitios web y páginas de aterrizaje",
      omnichannel_messaging: "Mensajería en todos los canales",
      marketing_digital_growth_enablement: "Marketing y crecimiento",
    },
  },

  taskTemplates: {
    market_opportunity_intelligence: {
      name: "Investigación de oportunidades de mercado",
      short: "Encuentra negocios a los que realmente podamos ayudar",
      description:
        "Encuentra negocios en un mercado, busca problemas reales que se puedan ver desde afuera, contrasta los hallazgos importantes con fuentes externas y determina dónde OpenCube realmente puede ayudar.",
      instruction:
        "Revisa negocios de {vertical} en {geography}. Encuentra unos {count}, busca problemas visibles en sus páginas públicas, contrasta los hallazgos importantes con fuentes externas y decide dónde OpenCube realmente puede ayudar.",
    },
  },

  team: {
    title: "Tu equipo",
    kind: {
      agent: "Agente de IA",
      engine: "Motor de decisión",
    },
    kindHelp: {
      agent: "Lee y razona sobre fuentes reales usando un modelo de lenguaje.",
      engine:
        "Sin modelo de lenguaje. Un conjunto fijo de reglas que da la misma respuesta ante la misma evidencia, siempre.",
    },
    members: {
      market_scout: {
        name: "Explorador de mercado",
        role: "Encuentra los negocios adecuados para revisar.",
        detail:
          "Busca en el mercado por zona, descarta lo que queda fuera del área objetivo y entrega una lista corta que vale la pena investigar.",
      },
      business_investigator: {
        name: "Investigador de negocios",
        role: "Busca problemas reales que cualquiera podría ver.",
        detail:
          "Lee las páginas públicas de cada negocio y registra observaciones simples; nunca supone. Todo lo que concluye queda atado a algo que puede citar.",
      },
      verification_agent: {
        name: "Agente de verificación",
        role: "Contrasta los hallazgos importantes en otro lado.",
        detail:
          "Busca fuentes que el negocio no controla y lee lo que dicen. Un negocio nunca puede ser su propia segunda opinión.",
      },
      opportunity_matcher: {
        name: "Evaluador de oportunidades",
        role: "Decide si la evidencia se sostiene.",
        detail:
          "Pone la investigación y la segunda opinión lado a lado y aplica un conjunto fijo de reglas. Misma evidencia, misma respuesta: sin criterio propio, sin modelo.",
      },
    },
    step: "Paso {step}",
    usedBy: "Se usa en",
    required: "Necesario para esta tarea",
    requiredHelp:
      "Esta tarea necesita todos los pasos. Saltarse uno significaría mostrarle una conclusión que nadie revisó.",
    page: {
      eyebrow: "Equipo",
      title: "Tu equipo",
      subtitle:
        "Los especialistas que OpenCube Intel asigna a una tarea. Cada uno hace un trabajo específico, y cada resultado indica cuál de ellos lo produjo.",
      workflowTitle: "Cómo trabajan juntos",
      workflowSubtitle: "Cada paso entrega su trabajo al siguiente.",
      futureTitle: "Más equipos después",
      futureBody:
        "Los nuevos tipos de trabajo traerán sus propios especialistas. Hoy solo existe el equipo de arriba, y nada aquí es un marcador de algo que no existe.",
    },
  },

  newTask: {
    eyebrow: "Nueva tarea",
    title: "¿Qué debe hacer tu equipo?",
    subtitle:
      "Elige el trabajo, mira quién lo hará, revisa la configuración y empieza. Tu equipo trabaja en segundo plano: no hace falta esperar en esta pantalla.",
    steps: {
      choose: "Elegir el trabajo",
      team: "Conocer al equipo",
      configure: "Revisar la configuración",
      review: "Empezar",
    },
    onlyTemplate: "Hoy hay un tipo de trabajo disponible.",
    onlyTemplateHelp:
      "Solo ofrecemos lo que el sistema realmente puede hacer. Aparecerán más tipos de trabajo a medida que sean reales.",
    config: {
      title: "Configuración de esta tarea",
      subtitle: "Qué va a cubrir esta tarea.",
      market: "Mercado",
      area: "Zona",
      businesses: "Negocios a revisar",
      locked: "Fijo",
      lockedHelp:
        "Fijo en esta versión. La investigación está ajustada a este mercado y esta zona, así que cambiarlo daría resultados que no podríamos respaldar.",
      businessesLockedHelp:
        "Fijo en {count}. Es un límite de costo, no una configuración.",
      capabilities: "Servicios para los que es esta tarea",
      capabilitiesHelp:
        "Se registra con la tarea para saber para qué se hizo. No cambia lo que revisa tu equipo: eso lo define qué buscamos.",
      capabilitiesEmpty: "Elige al menos un servicio.",
    },
    instruction: {
      title: "Qué estás pidiendo",
      subtitle:
        "Esto es exactamente lo que se le pedirá a tu equipo, redactado a partir de la configuración de arriba.",
    },
    launch: "Empezar esta tarea",
    launching: "Empezando…",
    launched: "Tu equipo ya está en ello",
    launchedHelp: "Llevándote a la vista en vivo…",
    disabled: "Iniciar tareas está desactivado en esta versión",
    disabledHelp:
      "Esta versión puede leer resultados anteriores, pero no puede iniciar trabajo nuevo.",
    costNote:
      "Empezar una tarea hace investigación real: visita sitios web reales y ejecuta análisis reales. Tarda unos minutos.",
    error: "No se pudo iniciar tu tarea",
  },

  taskActivity: {
    title: "Tu equipo está trabajando",
    titleDone: "Tarea completa",
    titleFailed: "La tarea terminó con problemas",
    subtitle: "Puedes salir de esta página: el trabajo continúa sin ti.",
    subtitleDone: "Esto es lo que encontró tu equipo.",
    waiting: "En espera",
    working: "Trabajando",
    done: "Listo",
    problem: "Problema",
    memberDetail: {
      scoutWorking: "Buscando negocios",
      scoutDone: "{count} candidatos encontrados",
      scoutDoneNoCount: "Negocios encontrados",
      investigatorWorking: "{done} de {total} investigados",
      investigatorDone: "{count} negocios investigados",
      verifierWorking: "Contrastando hallazgos con fuentes externas",
      verifierDone: "{count} oportunidades contrastadas",
      matcherWorking: "Sopesando la evidencia",
      matcherDone: "{count} oportunidades evaluadas",
      combinedNote:
        "Contrastar y decidir ocurren juntos en un mismo paso, así que terminan a la vez.",
    },
    summary: {
      title: "Qué obtuvimos",
      candidates: "candidatos encontrados",
      businesses: "negocios investigados",
      opportunities: "oportunidades evaluadas",
      goodFit: "vale la pena explorar",
      needsPerson: "requieren una persona",
    },
    viewResults: "Ver los resultados",
  },

  taskBrief: {
    title: "Resumen de la tarea",
    subtitle: "Qué se pidió, dónde y quién hizo el trabajo.",
    task: "Tarea",
    instruction: "Qué se pidió",
    market: "Mercado",
    area: "Zona",
    businessesRequested: "Negocios solicitados",
    servicesRecorded: "Servicios para los que fue esta tarea",
    teamUsed: "Equipo en esta tarea",
    execution: "Cuándo se ejecutó",
    started: "Empezó",
    finished: "Terminó",
    duration: "Duró",
    reference: "Referencia de la tarea",
    stillRunning: "Todavía en curso",
  },

  tasks: {
    eyebrow: "Tu trabajo",
    title: "Tareas",
    subtitle:
      "Todo lo que le has pedido a tu equipo. Cada tarea es un recorrido completo de un mercado, de principio a fin.",
    newTask: "Nueva tarea",
    empty: "Todavía no hay tareas",
    emptyHelp: "Empieza tu primera tarea y tu equipo se pondrá a trabajar.",
    card: {
      teamMembers: "{count} en el equipo",
      businesses: "{count} negocios",
      businessesOne: "1 negocio",
      completedIn: "Listo en {duration}",
      running: "En curso ahora",
      goodFit: "{count} vale la pena explorar",
      needsReview: "{count} requieren una persona",
      nothingYet: "Todavía nada evaluado",
      viewResults: "Ver resultados",
      reference: "Referencia",
    },
  },

  reasons: {
    CONFIRMED_NO_VERIFICATION:
      "Encontramos señales claras de esto por nuestra cuenta, y no hizo falta una segunda opinión para actuar.",
    CONFIRMED_INDEPENDENTLY_SUPPORTED:
      "Lo encontramos nosotros y una fuente externa dijo lo mismo. Es el caso más sólido que podemos presentar.",
    CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT:
      "Lo encontramos, pero una fuente externa lo negó de plano. Dos fuentes creíbles dicen cosas opuestas, así que debe revisarlo una persona.",
    CONFIRMED_VERIFICATION_INCONCLUSIVE:
      "Lo encontramos nosotros. Las fuentes externas que leímos no lo aclararon, lo cual no debilita lo que vimos directamente.",
    CONFIRMED_NO_INDEPENDENT_SOURCE:
      "Lo encontramos nosotros y nadie independiente había escrito al respecto. Nuestra propia evidencia sigue en pie.",
    CONFIRMED_VERIFICATION_FAILED_TECHNICAL:
      "Lo encontramos nosotros. La segunda opinión tuvo un problema técnico, lo cual no dice nada en ningún sentido, así que nuestra evidencia sigue en pie.",

    CONTRADICTED_UNVERIFIED:
      "Encontramos lo contrario: este negocio ya lo tiene resuelto, así que no hay nada que arreglar.",
    CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT:
      "Vimos que este negocio ya lo tiene resuelto, pero una fuente externa sugirió lo contrario. Debe decidirlo una persona.",
    CONTRADICTED_INDEPENDENTLY_CONFIRMED:
      "Vimos que este negocio ya lo tiene resuelto y una fuente externa coincidió. Claramente no hay nada que arreglar.",
    CONTRADICTED_VERIFICATION_INCONCLUSIVE:
      "Vimos que este negocio ya lo tiene resuelto. Las fuentes externas no lo aclararon, lo cual no cambia lo que vimos.",
    CONTRADICTED_NO_INDEPENDENT_SOURCE:
      "Vimos que este negocio ya lo tiene resuelto y nadie independiente había escrito al respecto. Lo que vimos sigue en pie.",
    CONTRADICTED_VERIFICATION_FAILED_TECHNICAL:
      "Vimos que este negocio ya lo tiene resuelto. La segunda opinión falló técnicamente, lo cual no cambia nada.",

    INSUFFICIENT_EVIDENCE_UNVERIFIED:
      "Nada público lo aclaró y no se pidió una segunda opinión. No vamos a afirmar un problema que no podemos ver.",
    INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED:
      "No pudimos saberlo por las páginas del negocio, pero una fuente externa sugirió que sí hay algo. Una sola fuente no nos basta para afirmarlo, así que debe revisarlo una persona.",
    INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED:
      "No pudimos saberlo por las páginas del negocio, y una fuente externa dijo que no hay nada. Eso lo zanja como un no.",
    INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE:
      "Ni las páginas del negocio ni ninguna fuente externa lo aclararon. No vamos a suponerlo.",
    INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE:
      "Nada público lo aclaró y nadie independiente había escrito al respecto. Sencillamente no hay con qué trabajar.",
    INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL:
      "Nada público lo aclaró, y la segunda opinión falló técnicamente antes de poder ayudar.",
  },

  overview: {
    eyebrow: "OpenCube Intel",
    title: "Centro de mando",
    subtitle:
      "Todo lo que hemos aprendido de este mercado. Cada número viene de algo que realmente vimos y guardamos: nada en esta página está supuesto.",
    kpi: {
      runs: "Tareas",
      runsHintActive: "{count} en curso ahora",
      runsHintDone: "{count} terminados",
      businesses: "Negocios",
      businessesHint: "Revisados hasta ahora",
      researched: "Investigados",
      researchedHint: "{count} cosas que vimos y guardamos",
      secondOpinions: "Segundas opiniones",
      secondOpinionsHint: "Sobre {count} oportunidades evaluadas",
      goodFit: "Encajan",
      goodFitHint: "de {count} evaluadas",
      needsPerson: "Requieren una persona",
      needsPersonHint: "Donde la evidencia no coincide",
    },
    findings: {
      title: "Qué encontramos",
      description:
        "Lo que nos dijeron las propias páginas públicas del negocio, antes de que nadie lo revisara.",
      empty: "Todavía no hay hallazgos.",
    },
    verification: {
      title: "Segundas opiniones",
      description: "Lo que dijeron fuentes externas al negocio sobre lo mismo.",
      empty: "Todavía no hay segundas opiniones.",
    },
    fit: {
      title: "Dónde podemos ayudar",
      description:
        "Juntamos las dos cosas para decidir si tenemos algo que encaje.",
      empty: "Todavía no hay nada evaluado.",
    },
    highlights: {
      title: "Vale la pena mirar",
      description:
        "Negocios donde la evidencia respalda un problema que resolvemos. Que encaje no autoriza a contactarlos.",
      empty: "Todavía nada",
      emptyHelp: "Las oportunidades que encajan aparecen aquí cuando termina un análisis.",
    },
    capability: {
      title: "Qué necesitan más",
      description: "El servicio detrás de cada oportunidad que encaja.",
      empty: "Todavía no ha surgido ningún servicio.",
    },
    coverage: {
      title: "Qué revisamos",
      description: "Con qué frecuencia evaluamos cada tipo de oportunidad.",
      empty: "Todavía no hay nada evaluado.",
    },
    recent: {
      title: "Análisis recientes",
      description: "Cada análisis es un recorrido completo por este mercado, de principio a fin.",
      empty: "Todavía no hay análisis",
      emptyHelp:
        "Los análisis se inician desde el back end. En cuanto exista uno, su avance aparece aquí.",
    },
    error: "el centro de mando",
  },

  runs: {
    eyebrow: "Actividad",
    title: "Análisis",
    subtitle:
      "Un análisis busca negocios en este mercado, lee lo que cada uno muestra públicamente, pide una segunda opinión sobre lo que encontró y determina dónde podemos ayudar.",
    count: "{count} análisis",
    countOne: "1 análisis",
    live: "{count} en curso ahora",
    empty: "Todavía no hay análisis",
    emptyHelp:
      "Los análisis se inician desde el back end, no desde esta pantalla. En cuanto exista uno, aparece aquí con su avance en vivo.",
    error: "la lista de análisis",
    table: {
      run: "Análisis",
      status: "Estado",
      progress: "Negocios",
      outcomes: "Oportunidades",
      findings: "Oportunidades evaluadas",
      started: "Empezó",
      duration: "Duró",
      awaiting: "Buscando negocios",
      running: "{count} en curso",
      complete: "completo",
      failedCount: "{count} fallaron",
      goodFit: "{count} encajan",
      toReview: "{count} por revisar",
      notYet: "Sin evaluar aún",
    },
  },

  runDetail: {
    eyebrow: "Tarea",
    subtitle:
      "{vertical} en {geography}. Los números de abajo se cuentan de nuevo cada vez que abre esta página.",
    error: "este análisis",
    failedTitle: "Este análisis terminó con errores",
    failedHelp:
      "Eso no descarta el resto. Cada negocio que sí pudimos investigar fue revisado y evaluado, y esos resultados de abajo son reales.",
    meta: {
      created: "Creado",
      began: "Empezó",
      completed: "Terminó",
      duration: "Duró",
      screened: "Negocios filtrados",
    },
    kpi: {
      businesses: "Negocios",
      businessesHint: "{count} investigados",
      inProgress: "En curso",
      inProgressHint: "Investigándose ahora",
      failed: "Fallaron",
      failedHint: "No se pudieron investigar",
      findings: "Oportunidades evaluadas",
      findingsHint: "Definiciones revisadas en cada negocio",
      secondOpinions: "Segundas opiniones",
      secondOpinionsHint: "de {count} intentadas",
      opportunities: "Oportunidades",
      opportunitiesHint: "Evaluadas",
    },
    findings: {
      title: "Qué encontramos",
      emptyLive: "Todavía nada: seguimos leyendo estos negocios.",
      emptyDone: "Este análisis terminó sin encontrar nada que evaluar.",
    },
    fit: {
      title: "Dónde podemos ayudar",
      emptyLive: "Este análisis todavía no llegó al paso de evaluación.",
      emptyDone: "No había nada que evaluar, así que no se determinó ningún encaje.",
    },
    discovery: {
      title: "Cómo encontramos estos negocios",
      queries: "Búsquedas que hicimos",
      queriesEmpty: "No se registraron en este análisis.",
      capabilities: "Servicios considerados",
      capabilitiesEmpty: "Ninguno registrado.",
      finalCounts: "Recuento final",
      finalCountsValue: "{done} investigados · {failed} fallaron de {total}",
    },
    tabs: {
      businesses: "Negocios",
      opportunities: "Oportunidades",
      label: "Secciones de este análisis",
    },
    businessesTable: {
      business: "Negocio",
      status: "Investigación",
      sources: "Páginas leídas",
      evidence: "Lo que vimos",
      findings: "Oportunidades evaluadas",
      findingsCount: "{count} evaluadas",
      opportunities: "Oportunidades",
      goodFit: "{count} encajan",
      site: "Sitio web",
      notYet: "Sin evaluar aún",
      empty: "Todavía no hay negocios",
      emptyHelp:
        "Cuando termine el paso de búsqueda, cada negocio elegido aparecerá aquí como una fila.",
      error: "los negocios de este análisis",
    },
    opportunitiesEmpty: "Todavía no hay oportunidades",
    opportunitiesEmptyLive:
      "Este análisis todavía no llegó al paso de revisión y evaluación.",
    opportunitiesEmptyDone: "Aquí no había nada que evaluar.",
    opportunitiesFilteredEmpty: "Nada en este grupo",
    opportunitiesFilteredHelp: "Todo lo de este análisis quedó en otro grupo.",
    opportunitiesError: "las oportunidades de este análisis",
  },

  matches: {
    eyebrow: "Resultados",
    title: "Oportunidades",
    subtitle:
      "Todo lo que evaluamos, en todos los análisis. También guardamos aquello a lo que dijimos que no: saber qué descartamos, y por qué, es parte de la respuesta.",
    error: "la lista de oportunidades",
    empty: "Todavía no hay oportunidades",
    emptyHelp: "Las oportunidades aparecen cuando un análisis llega al paso de evaluación.",
    filteredEmpty: "Nada en este grupo",
    filteredHelp: "Pruebe otro filtro: todo cae exactamente en uno de estos tres.",
    table: {
      business: "Negocio",
      opportunity: "Oportunidad",
      finding: "Qué encontramos",
      secondOpinion: "Segunda opinión",
      fit: "¿Podemos ayudar?",
      capability: "Servicio",
      reason: "Por qué",
      capabilityNote:
        "{label}: es el servicio que corresponde a este tipo de problema, no una prueba de que este negocio lo necesite.",
    },
  },

  matchDetail: {
    eyebrow: "Oportunidad",
    error: "esta oportunidad",
    at: "en",
    meta: {
      run: "Análisis",
      type: "Tipo",
      decided: "Evaluado",
      id: "Referencia",
    },
    strip: {
      finding: "Qué encontramos",
      secondOpinion: "Segunda opinión",
      fit: "¿Podemos ayudar?",
    },
    step1: {
      eyebrow: "Paso 1 · Nuestra investigación",
      title: "Qué concluimos",
      description: "Nuestra lectura de la evidencia de abajo. Nunca se sostiene sola.",
      confidence: "Qué tan seguros",
      supporting: "Lo respalda",
      contradicting: "Lo contradice",
      id: "Referencia",
      empty: "No pudimos cargar este registro",
      emptyHelp: "La evidencia con la que se formó sigue listada abajo.",
    },
    step2: {
      eyebrow: "Paso 2 · Evidencia",
      title: "Qué vimos realmente",
      description:
        "Observaciones simples de las páginas públicas del propio negocio, cada una con enlace a donde la vimos.",
      empty: "Aquí no se registró nada",
      emptyHelp:
        "Formamos esta conclusión sin nada que pudiéramos citar, que es justamente por qué el hallazgo de arriba dice que no pudimos saberlo.",
    },
    step3: {
      eyebrow: "Paso 3 · Segunda opinión",
      title: "Qué dijo alguien más",
      description:
        "Leído solo en sitios que el negocio no controla. Un negocio no puede ser su propia segunda opinión.",
      question: "Qué preguntamos",
      empty: "No pedimos una segunda opinión",
      emptyHelp:
        "Esto pasó al paso final solo con nuestra investigación, y la razón de abajo lo dice.",
      noSource:
        "No encontramos a nadie independiente del negocio que hablara de esto. Lo registramos aparte: no es lo mismo que haber encontrado un «no».",
      sources: "Fuentes externas leídas",
      candidates: "Fuentes consideradas",
      rejected: "Fuentes descartadas",
      confidence: "Qué tan seguros",
      independentEvidence: "Qué dijeron las fuentes externas",
      queries: "Búsquedas que hicimos",
      rejectedTitle: "Fuentes descartadas por no ser independientes ({count})",
    },
    step4: {
      eyebrow: "Paso 4 · La decisión",
      title: "Por qué este resultado",
      description:
        "Con las mismas entradas, siempre la misma respuesta. Aquí nada queda a criterio.",
      exactWording: "Redacción exacta registrada por el sistema",
    reasonCode: "Razón",
      caveat:
        "Esto solo dice si tenemos algo que encaje. Contactar o no a este negocio es una decisión que toma una persona, fuera de este sistema.",
    },
    capability: {
      title: "Cuál de nuestros servicios encaja",
      description:
        "Es el servicio que corresponde a este tipo de problema. No es una conclusión de que este negocio lo necesite.",
      empty: "No hay servicio registrado.",
      supporting: "También relevantes",
    },
    business: {
      title: "El negocio",
      name: "Nombre",
      address: "Dirección",
      website: "Sitio web",
      phone: "Teléfono",
      maps: "Mapa",
      id: "Referencia",
    },
    definition: {
      title: "Qué estábamos buscando",
      description:
        "La definición escrita con la que lo evaluamos. No inventamos categorías sobre la marcha.",
      evidenceSignals: "Señales de que es un problema",
      contradictionSignals: "Señales de que no lo es",
      publiclyObservable: "Visible públicamente",
      notPubliclyObservable: "Normalmente no visible en público",
      requiresVerification: "Siempre requiere segunda opinión",
    },
  },

  businesses: {
    eyebrow: "Directorio",
    title: "Negocios",
    subtitle:
      "Todos los negocios que hemos revisado. El mismo negocio puede aparecer en varios análisis sin duplicarse, así que estos totales los cubren todos.",
    count: "{count} negocios revisados",
    countOne: "1 negocio revisado",
    error: "el directorio de negocios",
    empty: "Todavía no hay negocios",
    emptyHelp: "Los negocios aparecen aquí cuando un análisis los encuentra.",
    table: {
      business: "Negocio",
      website: "Sitio web",
      runs: "Análisis",
      runsTitle: "{total} investigaciones, {done} terminadas",
      findings: "Oportunidades evaluadas",
      goodFit: "Encajan",
      toReview: "Por revisar",
      lastLooked: "Última revisión",
    },
  },

  catalog: {
    eyebrow: "Referencia",
    title: "Qué buscamos",
    subtitle:
      "Solo evaluamos los problemas escritos aquí, y cada uno corresponde a un servicio que ofrecemos. Nada se inventa mientras corre un análisis.",
    vertical: "Mercado",
    geography: "Zona",
    error: "esta página",
    evaluated: "Lo revisamos",
    declaredOnly: "Escrito, aún sin revisar",
    evaluatedHelp: "Evaluamos cada negocio con este criterio.",
    declaredOnlyHelp: "Escrito para más adelante. Hoy no lo evaluamos.",
    capabilities: {
      title: "Qué ofrecemos",
      description:
        "Nuestros servicios. Ver uno junto a una oportunidad significa que es el tipo de solución adecuado, no que el negocio lo haya pedido.",
    },
    defaults: {
      title: "Incluido en cada análisis",
      description: "Los servicios que considera cada análisis.",
    },
  },

  notFound: {
    eyebrow: "OpenCube Intel",
    title: "Aquí no hay nada",
    body: "No hay nada en esta dirección. El enlace puede estar viejo, o lo que señalaba nunca se guardó.",
    action: "Volver al centro de mando",
  },

  errors: {
    offlineTitle: "No podemos conectar con el servicio",
    offlineBody:
      "No se cargó nada, así que nada en esta pantalla sería correcto. Verifique que el servicio esté activo y vuelva a intentar.",
    notFoundTitle: "No se encontró {context}",
    notFoundBody:
      "Puede pertenecer a algo que nunca se guardó, o el enlace puede estar mal.",
    genericTitle: "Esto no se pudo cargar",
    fallbackContext: "Ese registro",
  },
};
