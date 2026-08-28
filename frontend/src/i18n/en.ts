/**
 * English copy. Every user-visible string in the product lives here.
 *
 * House style: write for someone who runs a business, not someone who built
 * the pipeline. Say what happened and what it means for them. Avoid
 * "hypothesis", "epistemic", "reconciliation", "deterministic" in body copy —
 * the underlying record names still appear where they are literally the
 * data (a reason code, a status value), but never as the explanation.
 */

export const en = {
  brand: {
    product: "OpenCube Intel",
    tagline: "Market intelligence you can check",
    logoAlt: "OpenCube Studio",
  },

  nav: {
    overview: "Command centre",
    runs: "Analyses",
    tasks: "Tasks",
    team: "Team",
    matches: "Opportunities",
    businesses: "Businesses",
    catalog: "What we look for",
    skipToContent: "Skip to content",
    primary: "Main navigation",
    open: "Open menu",
    close: "Close menu",
    breadcrumb: "You are here",
    workspace: "Current market",
    language: "Language",
    languageEnglish: "English",
    languageSpanish: "Español",
    evidenceBadge: "Every claim has a source",
  },

  common: {
    retry: "Try again",
    all: "All",
    of: "of",
    none: "None",
    notAvailable: "—",
    loading: "Loading",
    updated: "Updated {time}",
    refreshing: "Updating…",
    openRun: "Open analysis",
    viewAll: "See all",
    visitSite: "Visit site",
    openListing: "Open map listing",
    noWebsite: "No website found",
    noWebsiteHelp:
      "We could not find a website for this business. That is itself something we can observe.",
    business: "Business",
    opportunity: "Opportunity",
    run: "Analysis",
    startedRelative: "started {time}",
    collectedBy: "found by",
    sourceType: "Source",
  },

  status: {
    // What our own research concluded from the business's public presence.
    finding: {
        CONFIRMED: {
        label: "Confirmed",
        meaning: "We found real signs of this on the business's public pages.",
      },
      CONTRADICTED: {
        label: "Ruled out",
        meaning: "We found the opposite — this business already has this covered.",
      },
      INSUFFICIENT_EVIDENCE: {
        label: "Couldn't tell",
        meaning:
          "Nothing public settled it either way. That is not a 'no' — it just means we could not see it.",
      },
      UNVERIFIED: {
        label: "Not looked at yet",
        meaning: "We have not assessed this one yet.",
      },
    },

    // What a source outside the business said about the same thing.
    secondOpinion: {
        SUPPORTS: {
        label: "Agrees",
        meaning: "An outside source said the same thing we did.",
      },
      CONTRADICTS: {
        label: "Disagrees",
        meaning: "An outside source said the opposite of what we found.",
      },
      INSUFFICIENT_EVIDENCE: {
        label: "Didn't settle it",
        meaning: "We read outside sources, but they did not answer the question.",
      },
      NO_INDEPENDENT_SOURCE: {
        label: "No outside source",
        meaning:
          "We could not find anyone independent of the business writing about this. We record that as its own fact, not as a 'no'.",
      },
      FAILED: {
        label: "Check didn't finish",
        meaning:
          "The second-opinion check hit a technical problem. That is different from not finding an answer.",
      },
      IN_PROGRESS: {
        label: "Checking",
        meaning: "The second-opinion check is still running.",
      },
      NONE: {
        label: "Not checked",
        meaning: "We did not run a second-opinion check on this one.",
      },
      UNKNOWN: {
        label: "Unclear record",
        meaning:
          "This record does not match any state we know, so we are not forcing it into one.",
      },
    },

    // Whether OpenCube has something that fits.
    fit: {
        MATCHED: {
        label: "Good fit",
        meaning:
          "The evidence supports a problem one of our services solves. This is not permission to contact them — a person decides that.",
      },
      NOT_MATCHED: {
        label: "No fit",
        meaning:
          "We looked and decided no. Either the business already has this handled, or the evidence did not support it.",
      },
      UNRESOLVED: {
        label: "Needs a person",
        meaning:
          "Our research and the outside source disagree, or the evidence never got strong enough. Someone should look at this.",
      },
    },

    run: {
      CREATED: { label: "Created", meaning: "Saved, not started yet." },
      QUEUED: { label: "Queued", meaning: "Accepted and waiting to start." },
      DISCOVERING: {
        label: "Finding businesses",
        meaning: "Searching the market for businesses to look at.",
      },
      INVESTIGATING: {
        label: "Researching",
        meaning: "Reading each business's public pages and noting what we see.",
      },
      FINALIZING: {
        label: "Checking and matching",
        meaning: "Getting second opinions and working out where we can help.",
      },
      IN_PROGRESS: { label: "Running", meaning: "In progress." },
      COMPLETED: {
        label: "Finished",
        meaning: "Every business was researched and the analysis finished cleanly.",
      },
      FAILED: {
        label: "Finished with errors",
        meaning:
          "At least one business could not be researched. Everything else still produced real results.",
      },
    },

    research: {
      IN_PROGRESS: { label: "Researching", meaning: "Still working on this business." },
      COMPLETED: { label: "Done", meaning: "Finished successfully." },
      FAILED: { label: "Failed", meaning: "We could not finish this one." },
    },

    evidence: {
      SUPPORTING: {
        label: "Points to it",
        meaning: "We cited this as a reason to believe the opportunity is real.",
      },
      CONTRADICTING: {
        label: "Points against it",
        meaning: "We cited this as a reason to believe it is not.",
      },
      INDEPENDENT: {
        label: "Outside source",
        meaning: "Found on a site the business does not control.",
      },
    },
  },

  /**
   * A plain-language reading of each reason code.
   *
   * These do NOT decide anything and they do not replace the record: the back
   * end's own sentence is still shown, verbatim, underneath. This is a
   * translation of one fixed cell into words a business owner can read -- and
   * it is what lets the Spanish screen explain the decision in Spanish, which
   * the English-only stored sentence cannot do.
   */
  /**
   * Localized display labels for canonical back-end IDs.
   *
   * The pipeline stores English names; these map the stable ID to a label in
   * the reader's language. Nothing here mutates a record — an unknown ID falls
   * back to whatever the back end sent, so a new opportunity or service shows
   * up rather than disappearing.
   */
  commandCenter: {
    heroEyebrow: "OpenCube Intel",
    heroTitle: "Your AI operations team",
    heroSubtitle:
      "Tell your team what to look into. They find the businesses, read what is public, check the important findings elsewhere, and come back with what they can prove.",
    heroAction: "New task",
    heroSteps: {
      task: "You set the task",
      team: "Your team works",
      result: "You get evidence",
    },
    activeTitle: "Working now",
    activeSubtitle: "You can close this page — the work carries on.",
    recentTitle: "Recent tasks",
    recentSubtitle: "The last few things your team finished.",
    snapshotEyebrow: "Context",
    snapshotTitle: "Everything so far",
    snapshotSubtitle:
      "Totals across every task in this market. Each number comes from something we actually saw and saved.",
  },

  productLabels: {
    opportunities: {
      online_booking_friction: "Hard to book online",
      after_hours_lead_intake: "No way to reach them after hours",
      lead_follow_up_effectiveness: "Slow to follow up on enquiries",
      pbx_telephony_cost_optimization: "Phone system costs more than it should",
      crm_optimization_or_replacement: "Customer records need better tooling",
    },
    capabilities: {
      ai_lead_intake_qualification: "AI enquiry intake",
      ai_appointment_booking_assistance: "AI booking assistant",
      ai_voice_reception_telephone_agent: "AI phone reception",
      missed_call_after_hours_lead_recovery: "Missed-call and after-hours recovery",
      automated_lead_follow_up: "Automatic follow-up",
      ai_client_concierge_faq: "AI client concierge",
      crm: "Customer records (CRM)",
      cloud_pbx_business_telephony: "Cloud phone system",
      workflow_automation_integrations: "Workflow automation",
      website_landing_page_conversion: "Websites and landing pages",
      omnichannel_messaging: "All-channel messaging",
      marketing_digital_growth_enablement: "Marketing and growth",
    },
  },

  taskTemplates: {
    market_opportunity_intelligence: {
      name: "Market opportunity research",
      short: "Find businesses we can genuinely help",
      description:
        "Find businesses in a market, look for real problems we can see from the outside, check the important findings against outside sources, and work out where OpenCube can genuinely help.",
      instruction:
        "Look at {vertical} businesses in {geography}. Find about {count} of them, look for problems visible on their public pages, check the important findings against outside sources, and decide where OpenCube can genuinely help.",
    },
  },

  team: {
    title: "Your team",
    kind: {
      agent: "AI agent",
      engine: "Decision engine",
    },
    kindHelp: {
      agent: "Reads and reasons over real sources using a language model.",
      engine:
        "No language model at all. A fixed set of rules that gives the same answer for the same evidence, every time.",
    },
    members: {
      market_scout: {
        name: "Market Scout",
        role: "Finds the right businesses to look at.",
        detail:
          "Searches the market by neighbourhood, filters out anything outside the target area, and hands over a shortlist worth researching.",
      },
      business_investigator: {
        name: "Business Investigator",
        role: "Looks for real problems anyone could see.",
        detail:
          "Reads each business's own public pages and records plain observations — never guesses. Anything it concludes is tied back to something it can quote.",
      },
      verification_agent: {
        name: "Verification Agent",
        role: "Checks the important findings elsewhere.",
        detail:
          "Looks for sources the business does not control and reads what they say. A business can never be its own second opinion.",
      },
      opportunity_matcher: {
        name: "Opportunity Matcher",
        role: "Decides whether the evidence adds up.",
        detail:
          "Puts the research and the second opinion side by side and applies a fixed set of rules. Same evidence in, same answer out — no judgement calls, no model.",
      },
    },
    step: "Step {step}",
    usedBy: "Used by",
    required: "Required for this task",
    requiredHelp:
      "This task needs every step. Skipping one would mean showing you a conclusion nothing checked.",
    page: {
      eyebrow: "Team",
      title: "Your team",
      subtitle:
        "The specialists OpenCube Intel puts on a task. Each one does a specific job, and every result tells you which of them produced it.",
      workflowTitle: "How they work together",
      workflowSubtitle: "Each step hands its work to the next.",
      futureTitle: "More teams later",
      futureBody:
        "New kinds of work will bring their own specialists. Only the team above exists today, and nothing here is a placeholder for something that does not.",
    },
  },

  newTask: {
    eyebrow: "New task",
    title: "What should your team do?",
    subtitle:
      "Pick the work, see who will do it, check the settings, and start. Your team works in the background — you do not need to wait on this screen.",
    steps: {
      choose: "Choose the work",
      team: "Meet the team",
      configure: "Check the settings",
      review: "Start",
    },
    onlyTemplate: "One kind of work is available today.",
    onlyTemplateHelp:
      "We only offer what the system can genuinely do. More kinds of work will appear here as they become real.",
    config: {
      title: "Settings for this task",
      subtitle: "What this task will cover.",
      market: "Market",
      area: "Area",
      businesses: "Businesses to look at",
      locked: "Fixed",
      lockedHelp:
        "Fixed for this version. The research is tuned to this market and area, so changing it would produce results we could not stand behind.",
      businessesLockedHelp:
        "Fixed at {count}. This is a cost limit, not a setting.",
      capabilities: "Services this task is for",
      capabilitiesHelp:
        "Recorded with the task so you know what it was run for. It does not change what your team looks at — that is set by what we look for.",
      capabilitiesEmpty: "Choose at least one service.",
    },
    instruction: {
      title: "What you are asking for",
      subtitle:
        "This is exactly what your team will be asked to do, written out from the settings above.",
    },
    launch: "Start this task",
    launching: "Starting…",
    launched: "Your team is on it",
    launchedHelp: "Taking you to the live view…",
    disabled: "Starting tasks is turned off in this build",
    disabledHelp:
      "This build can read past results but cannot start new work.",
    costNote:
      "Starting a task does real research: it visits real websites and runs real analysis. It takes a few minutes.",
    error: "Your task could not be started",
  },

  taskActivity: {
    title: "Your team is working",
    titleDone: "Task complete",
    titleFailed: "Task finished with problems",
    subtitle: "You can leave this page — the work carries on without you.",
    subtitleDone: "Here is what your team found.",
    waiting: "Waiting",
    working: "Working",
    done: "Done",
    problem: "Problem",
    memberDetail: {
      scoutWorking: "Looking for businesses",
      scoutDone: "{count} candidates found",
      scoutDoneNoCount: "Businesses found",
      investigatorWorking: "{done} of {total} researched",
      investigatorDone: "{count} businesses researched",
      verifierWorking: "Checking findings against outside sources",
      verifierDone: "{count} findings checked",
      matcherWorking: "Weighing up the evidence",
      matcherDone: "{count} opportunities assessed",
      combinedNote:
        "Checking and deciding happen together in one step, so they finish together.",
    },
    summary: {
      title: "What came back",
      candidates: "candidates found",
      businesses: "businesses researched",
      opportunities: "opportunities assessed",
      goodFit: "worth exploring",
      needsPerson: "need a person",
    },
    viewResults: "See the results",
  },

  taskBrief: {
    title: "Task brief",
    subtitle: "What was asked, where, and who did the work.",
    task: "Task",
    instruction: "What was asked",
    market: "Market",
    area: "Area",
    businessesRequested: "Businesses requested",
    servicesRecorded: "Services this task was for",
    teamUsed: "Team on this task",
    execution: "When it ran",
    started: "Started",
    finished: "Finished",
    duration: "Took",
    reference: "Task reference",
    stillRunning: "Still running",
  },

  tasks: {
    eyebrow: "Your work",
    title: "Tasks",
    subtitle:
      "Everything you have asked your team to do. Each one is a full sweep of a market, start to finish.",
    newTask: "New task",
    empty: "No tasks yet",
    emptyHelp: "Start your first task and your team will get to work.",
    card: {
      teamMembers: "{count} on the team",
      businesses: "{count} businesses",
      completedIn: "Done in {duration}",
      running: "Running now",
      goodFit: "{count} worth exploring",
      needsReview: "{count} need a person",
      nothingYet: "Nothing assessed yet",
      viewResults: "See results",
      reference: "Reference",
    },
  },

  reasons: {
    CONFIRMED_NO_VERIFICATION:
      "We found solid signs of this ourselves, and no second opinion was needed to act on it.",
    CONFIRMED_INDEPENDENTLY_SUPPORTED:
      "We found this ourselves, and an outside source said the same thing. That is the strongest case we can make.",
    CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT:
      "We found this, but an outside source flatly disagreed. Two credible sources say opposite things, so a person needs to look.",
    CONFIRMED_VERIFICATION_INCONCLUSIVE:
      "We found this ourselves. The outside sources we read did not settle it either way, which does not weaken what we saw directly.",
    CONFIRMED_NO_INDEPENDENT_SOURCE:
      "We found this ourselves, and nobody independent had written about it. Our own evidence still stands.",
    CONFIRMED_VERIFICATION_FAILED_TECHNICAL:
      "We found this ourselves. The second-opinion check hit a technical problem, which tells us nothing either way, so our evidence still stands.",

    CONTRADICTED_UNVERIFIED:
      "We found the opposite — this business already has this covered — so there is nothing for us to fix.",
    CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT:
      "We saw that this business already has this covered, but an outside source suggested otherwise. A person should decide.",
    CONTRADICTED_INDEPENDENTLY_CONFIRMED:
      "We saw that this business already has this covered, and an outside source agreed. Clearly nothing to fix here.",
    CONTRADICTED_VERIFICATION_INCONCLUSIVE:
      "We saw that this business already has this covered. The outside sources did not settle it, which does not change what we saw.",
    CONTRADICTED_NO_INDEPENDENT_SOURCE:
      "We saw that this business already has this covered, and nobody independent had written about it. What we saw still stands.",
    CONTRADICTED_VERIFICATION_FAILED_TECHNICAL:
      "We saw that this business already has this covered. The second-opinion check failed technically, which changes nothing.",

    INSUFFICIENT_EVIDENCE_UNVERIFIED:
      "Nothing public settled this either way, and no second opinion was taken. We will not claim a problem we cannot see.",
    INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED:
      "We could not tell from the business's own pages, but an outside source suggested there is something here. One source is not enough for us to call it, so a person should look.",
    INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED:
      "We could not tell from the business's own pages, and an outside source said there is nothing here. That settles it as a no.",
    INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE:
      "Neither the business's own pages nor any outside source settled this. We are not guessing.",
    INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE:
      "Nothing public settled this, and nobody independent had written about it either. There is simply nothing to go on.",
    INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL:
      "Nothing public settled this, and the second-opinion check failed technically before it could help.",
  },

  overview: {
    eyebrow: "OpenCube Intel",
    title: "Command centre",
    subtitle:
      "Everything we have learned about this market. Every number here comes from something we actually saw and saved — nothing on this page is guessed.",
    kpi: {
      runs: "Tasks",
      runsHintActive: "{count} running now",
      runsHintDone: "{count} finished",
      businesses: "Businesses",
      businessesHint: "Looked at so far",
      researched: "Researched",
      researchedHint: "{count} things we saw and saved",
      secondOpinions: "Second opinions",
      secondOpinionsHint: "Across {count} findings",
      goodFit: "Good fit",
      goodFitHint: "of {count} we assessed",
      needsPerson: "Needs a person",
      needsPersonHint: "Where the evidence disagrees",
    },
    findings: {
      title: "What we found",
      description: "What the business's own public pages told us, before anyone checked.",
      empty: "Nothing found yet.",
    },
    verification: {
      title: "Second opinions",
      description: "What sources outside the business said about the same thing.",
      empty: "No second opinions yet.",
    },
    fit: {
      title: "Where we can help",
      description: "Putting the two together to decide whether we have something that fits.",
      empty: "Nothing assessed yet.",
    },
    highlights: {
      title: "Worth a look",
      description:
        "Businesses where the evidence supports a problem we solve. A good fit is not permission to contact them.",
      empty: "Nothing yet",
      emptyHelp: "Good-fit opportunities show up here once an analysis finishes.",
    },
    capability: {
      title: "What they need most",
      description: "The service behind each good-fit opportunity.",
      empty: "No service has come up yet.",
    },
    coverage: {
      title: "What we checked for",
      description: "How often we assessed each kind of opportunity.",
      empty: "Nothing assessed yet.",
    },
    recent: {
      title: "Recent analyses",
      description: "Each analysis is one sweep across this market, start to finish.",
      empty: "No analyses yet",
      emptyHelp:
        "Analyses are started from the back end. As soon as one exists, its progress shows up here.",
    },
    error: "the command centre",
  },

  runs: {
    eyebrow: "Activity",
    title: "Analyses",
    subtitle:
      "An analysis finds businesses in this market, reads what each one shows publicly, gets a second opinion on what it found, and works out where we can help.",
    count: "{count} analyses",
    countOne: "1 analysis",
    live: "{count} running now",
    empty: "No analyses yet",
    emptyHelp:
      "Analyses are started from the back end, not from this screen. As soon as one exists, it shows up here with live progress.",
    error: "the list of analyses",
    table: {
      run: "Analysis",
      status: "Status",
      progress: "Businesses",
      outcomes: "Opportunities",
      findings: "Findings",
      started: "Started",
      duration: "Took",
      awaiting: "Finding businesses",
      running: "{count} still going",
      complete: "all done",
      failedCount: "{count} failed",
      goodFit: "{count} good fit",
      toReview: "{count} to review",
      notYet: "Not assessed yet",
    },
  },

  runDetail: {
    eyebrow: "Task",
    subtitle:
      "{vertical} in {geography}. The numbers below are counted fresh every time you open this page.",
    error: "this analysis",
    failedTitle: "This analysis finished with errors",
    failedHelp:
      "That does not throw away the rest. Every business we did manage to research was checked and assessed, and those results below are real.",
    meta: {
      created: "Started",
      began: "Began",
      completed: "Finished",
      duration: "Took",
      screened: "Businesses screened",
    },
    kpi: {
      businesses: "Businesses",
      businessesHint: "{count} researched",
      inProgress: "Still going",
      inProgressHint: "Being researched now",
      failed: "Failed",
      failedHint: "Could not be researched",
      findings: "Findings",
      findingsHint: "Things we noticed",
      secondOpinions: "Second opinions",
      secondOpinionsHint: "of {count} attempted",
      opportunities: "Opportunities",
      opportunitiesHint: "Assessed",
    },
    findings: {
      title: "What we found",
      emptyLive: "Nothing yet — we are still reading these businesses.",
      emptyDone: "This analysis finished without finding anything to assess.",
    },
    fit: {
      title: "Where we can help",
      emptyLive: "This analysis has not got to the matching step yet.",
      emptyDone: "There was nothing to assess, so nothing was matched.",
    },
    discovery: {
      title: "How we found these businesses",
      queries: "Searches we ran",
      queriesEmpty: "Not recorded for this analysis.",
      capabilities: "Services in scope",
      capabilitiesEmpty: "None recorded.",
      finalCounts: "Final tally",
      finalCountsValue: "{done} researched · {failed} failed of {total}",
    },
    tabs: {
      businesses: "Businesses",
      opportunities: "Opportunities",
      label: "Sections of this analysis",
    },
    businessesTable: {
      business: "Business",
      status: "Research",
      sources: "Pages read",
      evidence: "What we saw",
      findings: "Findings",
      findingsCount: "{count} found",
      opportunities: "Opportunities",
      goodFit: "{count} good fit",
      site: "Website",
      notYet: "Not assessed yet",
      empty: "No businesses yet",
      emptyHelp:
        "Once the search step finishes, every business it picked shows up here as a row.",
      error: "the businesses in this analysis",
    },
    opportunitiesEmpty: "No opportunities yet",
    opportunitiesEmptyLive:
      "This analysis has not got to the checking and matching step yet.",
    opportunitiesEmptyDone: "There was nothing here to assess.",
    opportunitiesFilteredEmpty: "Nothing in this group",
    opportunitiesFilteredHelp: "Everything in this analysis landed somewhere else.",
    opportunitiesError: "the opportunities in this analysis",
  },

  matches: {
    eyebrow: "Results",
    title: "Opportunities",
    subtitle:
      "Everything we assessed, across every analysis. We keep the ones we said no to as well — knowing what we ruled out, and why, is part of the answer.",
    error: "the opportunity list",
    empty: "No opportunities yet",
    emptyHelp: "Opportunities show up once an analysis reaches the matching step.",
    filteredEmpty: "Nothing in this group",
    filteredHelp: "Try another filter — everything lands in exactly one of these three.",
    table: {
      business: "Business",
      opportunity: "Opportunity",
      finding: "What we found",
      secondOpinion: "Second opinion",
      fit: "Can we help?",
      capability: "Service",
      reason: "Why",
      capabilityNote:
        "{label} — this is which service matches this kind of problem, not proof this business needs it.",
    },
  },

  matchDetail: {
    eyebrow: "Opportunity",
    error: "this opportunity",
    at: "at",
    meta: {
      run: "Analysis",
      type: "Kind",
      decided: "Assessed",
      id: "Reference",
    },
    strip: {
      finding: "What we found",
      secondOpinion: "Second opinion",
      fit: "Can we help?",
    },
    step1: {
      eyebrow: "Step 1 · Our research",
      title: "What we concluded",
      description: "Our reading of the evidence below. It never stands on its own.",
      confidence: "How sure",
      supporting: "Points to it",
      contradicting: "Points against",
      id: "Reference",
      empty: "We could not load this record",
      emptyHelp: "The evidence it was built from is still listed below.",
    },
    step2: {
      eyebrow: "Step 2 · Evidence",
      title: "What we actually saw",
      description:
        "Plain observations from the business's own public pages, each with a link back to where we saw it.",
      empty: "Nothing was recorded here",
      emptyHelp:
        "We formed this view without anything we could quote — which is exactly why the finding above says we could not tell.",
    },
    step3: {
      eyebrow: "Step 3 · Second opinion",
      title: "What someone else said",
      description:
        "Read only from sites the business does not control. A business cannot be its own second opinion.",
      question: "What we asked",
      empty: "We did not run a second opinion",
      emptyHelp: "This went to the final step on our own research alone, and the reason below says so.",
      noSource:
        "We could not find anyone independent of the business writing about this. We record that on its own — it is not the same as finding a 'no'.",
      sources: "Outside sources read",
      candidates: "Sources considered",
      rejected: "Sources set aside",
      confidence: "How sure",
      independentEvidence: "What the outside sources said",
      queries: "Searches we ran",
      rejectedTitle: "Sources we set aside because they were not independent ({count})",
    },
    step4: {
      eyebrow: "Step 4 · The decision",
      title: "Why this outcome",
      description: "Same inputs, same answer, every time. Nothing here is a judgement call.",
      exactWording: "Exact wording recorded by the system",
    reasonCode: "Reason",
      caveat:
        "This only says whether we have something that fits. Whether to contact this business is a decision a person makes, outside this system.",
    },
    capability: {
      title: "Which of our services fits",
      description:
        "This is the service that matches this kind of problem. It is not a finding that this business needs it.",
      empty: "No service recorded.",
      supporting: "Also relevant",
    },
    business: {
      title: "The business",
      name: "Name",
      address: "Address",
      website: "Website",
      phone: "Phone",
      maps: "Map",
      id: "Reference",
    },
    definition: {
      title: "What we were looking for",
      description:
        "The written definition we assessed against. We do not invent categories as we go.",
      evidenceSignals: "Signs it is a problem",
      contradictionSignals: "Signs it is not",
      publiclyObservable: "Visible in public",
      notPubliclyObservable: "Not usually visible in public",
      requiresVerification: "Always needs a second opinion",
    },
  },

  businesses: {
    eyebrow: "Directory",
    title: "Businesses",
    subtitle:
      "Every business we have looked at. The same business can appear in several analyses without being added twice, so these totals cover all of them.",
    count: "{count} businesses looked at",
    countOne: "1 business looked at",
    error: "the business directory",
    empty: "No businesses yet",
    emptyHelp: "Businesses appear here once an analysis finds them.",
    table: {
      business: "Business",
      website: "Website",
      runs: "Analyses",
      runsTitle: "{total} research passes, {done} finished",
      findings: "Findings",
      goodFit: "Good fit",
      toReview: "To review",
      lastLooked: "Last looked at",
    },
  },

  catalog: {
    eyebrow: "Reference",
    title: "What we look for",
    subtitle:
      "We only assess the problems written down here, and each one maps to a service we offer. Nothing gets invented while an analysis is running.",
    vertical: "Market",
    geography: "Area",
    error: "this page",
    evaluated: "We check for this",
    declaredOnly: "Written down, not checked yet",
    evaluatedHelp: "We assess every business against this.",
    declaredOnlyHelp: "Written down for later. We do not assess it today.",
    capabilities: {
      title: "What we offer",
      description:
        "Our services. Seeing one next to an opportunity means it is the right kind of fix — not that the business has asked for it.",
    },
    defaults: {
      title: "Included in every analysis",
      description: "The services each analysis considers.",
    },
  },

  notFound: {
    eyebrow: "OpenCube Intel",
    title: "Nothing here",
    body: "There is nothing at this address. The link may be old, or what it pointed to was never saved.",
    action: "Back to the command centre",
  },

  errors: {
    offlineTitle: "We can't reach the service",
    offlineBody:
      "Nothing loaded, so nothing on this screen would be right. Check the service is running, then try again.",
    notFoundTitle: "{context} could not be found",
    notFoundBody:
      "It may belong to something that was never saved, or the link may be wrong.",
    genericTitle: "This didn't load",
    fallbackContext: "That record",
  },
} as const;

/**
 * Same shape as `en`, but with plain `string` values.
 *
 * `as const` above gives every entry a literal type, which is what lets the
 * keys be checked exhaustively. Widening the leaves here is what lets a
 * translation actually differ from the English while still failing the build
 * if it omits a key or invents one.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;
