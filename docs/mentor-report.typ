// ─────────────────────────────────────────────────────────
//  Nibras Student Planner — Feature Report
//  Typst document · April 22, 2026
// ─────────────────────────────────────────────────────────

#let accent  = rgb("#6366f1")
#let green   = rgb("#10b981")
#let amber   = rgb("#f59e0b")
#let ink     = rgb("#1e1b4b")
#let muted   = rgb("#64748b")
#let border  = rgb("#e2e8f0")
#let surface = rgb("#f8fafc")
#let white   = rgb("#ffffff")

// font aliases (system-available)
#let sans  = ("Noto Sans", "Liberation Sans")
#let serif = ("Noto Serif", "Liberation Serif")
#let mono  = ("Liberation Mono", "DejaVu Sans Mono")

// ── Page setup ────────────────────────────────────────────
#set page(
  paper: "a4",
  margin: (top: 24mm, bottom: 24mm, left: 22mm, right: 22mm),
  numbering: "1",
  number-align: right,
)

#set text(font: serif, size: 11pt, fill: ink)
#set par(leading: 0.85em, justify: true)
#set heading(numbering: none)

#show heading.where(level: 1): it => {
  v(0.4em)
  text(font: sans, size: 22pt, weight: "bold", fill: ink, it.body)
  v(0.15em)
  line(length: 100%, stroke: 1.5pt + border)
  v(0.5em)
}

#show heading.where(level: 2): it => {
  v(0.5em)
  text(font: sans, size: 13pt, weight: "bold", fill: ink, it.body)
  v(0.3em)
}

#show heading.where(level: 3): it => {
  v(0.4em)
  text(font: sans, size: 8.5pt, weight: "bold", fill: muted,
    tracking: 0.06em, upper(it.body))
  v(0.2em)
}

// ── Helpers ───────────────────────────────────────────────

#let section-label(n, title-text) = {
  text(font: sans, size: 8pt, weight: "bold", fill: accent,
    tracking: 0.16em, upper("Section " + n))
  v(0.1em)
  heading(level: 1, title-text)
}

#let callout(color: accent, title: none, body) = block(
  width: 100%, inset: (left: 14pt, top: 11pt, right: 14pt, bottom: 11pt),
  radius: (right: 6pt), fill: color.lighten(88%),
  stroke: (left: 3.5pt + color),
)[
  #if title != none { text(font: sans, size: 9.5pt, weight: "bold", title); v(0.15em) }
  #text(font: sans, size: 9.5pt, body)
]

#let pill(body, bg: accent.lighten(80%), fg: accent) = box(
  inset: (x: 7pt, y: 2pt), radius: 10pt, fill: bg,
)[#text(font: sans, size: 7.5pt, weight: "bold", fill: fg, body)]

#let tag-before = pill("BEFORE", bg: rgb("#fee2e2"), fg: rgb("#dc2626"))
#let tag-after  = pill("AFTER",  bg: rgb("#d1fae5"), fg: rgb("#065f46"))
#let tag-new    = pill("NEW",    bg: rgb("#d1fae5"), fg: rgb("#065f46"))
#let tag-mod    = pill("MOD",    bg: rgb("#dbeafe"), fg: rgb("#1e40af"))

#let file-item(badge, path) = block(
  width: 100%, inset: (x: 10pt, y: 6pt), radius: 5pt,
  fill: surface, stroke: 0.5pt + border,
)[
  #grid(columns: (auto, 1fr), gutter: 10pt,
    badge,
    text(font: mono, size: 8pt, path),
  )
]

#let score-bar(pct) = stack(
  dir: ltr, spacing: 8pt,
  block(height: 6pt, width: 120pt, radius: 3pt, fill: border)[
    #block(height: 6pt, width: pct * 1.2pt, radius: 3pt, fill: accent)
  ],
  text(font: sans, size: 8pt, weight: "bold", fill: accent, str(pct) + "%"),
)

#let track-card(rank, name, reason, pct) = block(
  width: 100%, inset: 12pt, radius: 7pt, stroke: 0.5pt + border,
)[
  #grid(columns: (28pt, 1fr), gutter: 10pt, align: top,
    text(font: sans, size: 13pt, weight: "bold", fill: accent, "\#" + rank),
    stack(spacing: 5pt,
      text(font: sans, size: 10pt, weight: "bold", name),
      text(font: sans, size: 8.5pt, fill: muted, reason),
      score-bar(pct),
    ),
  )
]

#let match-row(ok, body) = grid(
  columns: (14pt, 1fr), gutter: 4pt,
  if ok { text(fill: green, weight: "bold", "✓") } else { text(fill: muted, "✗") },
  text(font: sans, size: 9pt, body),
)

#let match-box(title, rows, formula) = block(
  width: 100%, inset: 12pt, radius: 6pt, fill: surface, stroke: 0.5pt + border,
)[
  #text(font: sans, size: 10pt, weight: "bold", title)
  #v(0.4em)
  #stack(spacing: 4pt, ..rows)
  #v(0.5em)
  #line(length: 100%, stroke: 0.5pt + border)
  #v(0.4em)
  #text(font: sans, size: 9pt, weight: "bold", formula)
]

#let flow-step(num, title, body) = grid(
  columns: (30pt, 1fr), gutter: 12pt, align: top,
  box(width: 26pt, height: 26pt, radius: 13pt, fill: accent)[
    #align(center + horizon)[
      #text(font: sans, size: 9pt, weight: "bold", fill: white, num)
    ]
  ],
  stack(spacing: 3pt,
    text(font: sans, size: 10pt, weight: "bold", title),
    text(font: sans, size: 9pt, fill: muted, body),
  ),
)

#let feature-card(icon, title, desc) = block(
  inset: 13pt, radius: 7pt, stroke: 0.5pt + border, width: 100%,
)[
  #text(size: 16pt, icon)
  #v(0.3em)
  #text(font: sans, size: 9.5pt, weight: "bold", title)
  #v(0.15em)
  #text(font: sans, size: 8.5pt, fill: muted, desc)
]

#let screenshot-ph(title, url) = block(
  width: 100%, inset: (x: 20pt, y: 28pt), radius: 8pt, fill: surface,
  stroke: (paint: border, dash: "dashed", thickness: 1.5pt),
)[
  #align(center)[
    #text(size: 11pt, "📸")
    #v(0.3em)
    #text(font: sans, size: 9.5pt, weight: "bold", title)
    #v(0.2em)
    #text(font: sans, size: 8.5pt, fill: accent, url)
  ]
]

#let status-badge(label) = box(
  inset: (x: 10pt, y: 3pt), radius: 10pt, fill: rgb("#d1fae5"),
)[#text(font: sans, size: 8pt, weight: "bold", fill: rgb("#065f46"), label)]


// ─────────────────────────────────────────────────────────
//  COVER PAGE
// ─────────────────────────────────────────────────────────
#page(numbering: none)[
  #v(1fr)
  #block(
    inset: (left: 28pt, top: 28pt, right: 28pt, bottom: 28pt),
    stroke: (left: 5pt + accent),
  )[
    #text(font: sans, size: 8.5pt, weight: "bold", fill: accent,
      tracking: 0.18em, upper("Mentor Technical Report"))
    #v(0.8em)
    #text(font: sans, size: 30pt, weight: "bold", fill: ink)[
      Nibras Student Planner \ Feature Report
    ]
    #v(0.5em)
    #text(font: sans, size: 14pt, fill: muted)[
      Track Recommendation System & Visual Degree Planner
    ]
    #v(2.2em)
    #grid(
      columns: (90pt, 1fr),
      row-gutter: 9pt,
      text(font: sans, size: 8pt, weight: "bold", fill: muted, tracking: 0.07em, upper("Date")),
      text(font: sans, size: 9.5pt, "April 22, 2026"),

      text(font: sans, size: 8pt, weight: "bold", fill: muted, tracking: 0.07em, upper("Project")),
      text(font: sans, size: 9.5pt, "Nibras Platform — Student Planner Sprint"),

      text(font: sans, size: 8pt, weight: "bold", fill: muted, tracking: 0.07em, upper("Live URL")),
      text(font: sans, size: 9.5pt, fill: accent, "nibras-web.fly.dev/planner"),

      text(font: sans, size: 8pt, weight: "bold", fill: muted, tracking: 0.07em, upper("Commits")),
      text(font: mono, size: 9pt, "54b5b62 · 9666d2d"),

      text(font: sans, size: 8pt, weight: "bold", fill: muted, tracking: 0.07em, upper("Stack")),
      text(font: sans, size: 9.5pt, "Next.js 15 · Fastify · Prisma · Fly.io"),
    )
    #v(1.8em)
    #box(
      inset: (x: 14pt, y: 7pt), radius: 16pt,
      fill: accent.lighten(88%), stroke: 0.5pt + accent.lighten(60%),
    )[
      #text(font: sans, size: 8.5pt, weight: "bold", fill: accent,
        "● \u{2002}All three services deployed and healthy")
    ]
  ]
  #v(1fr)
]


// ─────────────────────────────────────────────────────────
//  1. EXECUTIVE SUMMARY
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("1", "Executive Summary")

Before this sprint, students using the Nibras platform had no visual way to map out their
4-year degree path. Course planning was limited to a plain dropdown form that produced a flat
text list — with no sense of timeline, workload distribution, or how their choices related to
available specialisation tracks. Track selection was equally opaque: students were shown a list
of tracks with no guidance on which suited them based on what they had already studied.

This sprint delivered two interconnected upgrades. First, a *drag-and-drop 4-year × 2-term
visual degree grid* that lets students build their plan the way they think about it — by
dragging courses into year and term buckets. Second, an *algorithmic track recommendation
engine* that analyses the student's Year 1 course selections and surfaces the top 3 matching
specialisation tracks in real time, with match scores and plain-English explanations. Both
features are fully deployed and live with zero backend schema changes required.

#callout(color: green, title: "Outcome")[
  Students now see their full degree timeline at a glance, receive personalised track guidance
  the moment they start planning, and can confirm a track selection through a structured
  confirmation modal — all within the existing Nibras web platform.
]


// ─────────────────────────────────────────────────────────
//  2. WHAT WE BUILT
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("2", "What We Built")

== 2a — Visual 4-Year × 2-Term Drag-and-Drop Grid

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  block(inset: 14pt, radius: 7pt, stroke: 0.5pt + border, width: 100%)[
    #tag-before
    #v(0.6em)
    #set text(font: sans, size: 9pt, fill: muted)
    - Three dropdowns: course, year, term
    - "Add course" button → flat list
    - No timeline view
    - No unit totals
    - No visual sense of degree distribution
  ],
  block(inset: 14pt, radius: 7pt, stroke: 0.5pt + border, width: 100%)[
    #tag-after
    #v(0.6em)
    #set text(font: sans, size: 9pt, fill: muted)
    - 4-column × 2-row grid (Year 1–4 × Fall/Spring)
    - Left sidebar palette of unplaced courses
    - Drag from palette → drop into any cell
    - Drag between cells to move courses
    - Unit totals per cell and per year
    - Locked-plan state disables all editing
  ],
)
#v(0.6em)

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  feature-card("🗂️", "Course Palette",
    "Left sidebar lists every catalog course not yet placed. Scrollable, shows count of unplaced courses."),
  feature-card("📦", "Drop Cells",
    "8 droppable zones (Year 1–4 × Fall/Spring). Visual highlight when a card hovers over a cell."),
  feature-card("📊", "Unit Totals Row",
    "Bottom row shows Fall/Spring units per year and a combined year total. Updates live as courses move."),
  feature-card("🔒", "Locked-Plan State",
    "When plan.isLocked is true, all drag, drop, and remove interactions are disabled. A banner explains why."),
)
#v(0.6em)

#block(
  width: 100%, radius: 8pt, stroke: 0.5pt + border, clip: true,
)[
  #image("Drag-and-Drop Planner Grid.png", width: 100%)
]
#v(0.6em)

=== Files Changed — Grid

#file-item(tag-mod, "apps/web/app/(app)/planner/page.tsx")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/PlannerGrid.tsx")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/GridCell.tsx")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/CoursePalette.tsx")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/planner.module.css")
#v(0.3em)
#text(font: sans, size: 8.5pt, fill: muted)[
  Library added: `\@dnd-kit/core ^6.3.1` + `\@dnd-kit/utilities ^3.2.2`
]

== 2b — Track Recommendation System

After placing at least one Year 1 course, a dismissible banner appears automatically above the
grid showing the top 3 recommended tracks, each with a match score and a plain-English reason.
Clicking _Select_ on any track opens a confirmation modal; confirming calls the existing
`POST /select-track` endpoint. The banner disappears once a track is chosen.

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  feature-card("⚡", "Auto-Triggered Banner",
    "No button needed. Appears the moment any Year 1 course is placed. Refreshes live as courses move."),
  feature-card("🏆", "Top 3 Rankings",
    "Shows the three best-matching tracks with score pill, animated progress bar, and reason text."),
  feature-card("✅", "Confirmation Modal",
    "Clicking Select opens a modal with full track details before committing — prevents accidental selection."),
  feature-card("🔕", "Smart Dismissal",
    "Banner hides permanently once a track is selected. Can also be manually dismissed per session via ×."),
)
#v(0.6em)

#block(
  width: 100%, radius: 8pt, stroke: 0.5pt + border, clip: true,
)[
  #image("Recommendation Banner with Top 3 Tracks.jpeg", width: 100%)
]
#v(0.6em)

=== Files Changed — Recommendation

#file-item(tag-mod, "packages/contracts/src/programs.ts — added TrackRecommendationSchema")
#v(0.2em)
#file-item(tag-mod, "apps/api/src/features/programs/routes.ts — added GET /recommend-track")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/RecommendationBanner.tsx")
#v(0.2em)
#file-item(tag-new, "apps/web/app/(app)/planner/_components/recommendation-banner.module.css")


// ─────────────────────────────────────────────────────────
//  3. STRATEGY & DESIGN DECISIONS
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("3", "Strategy & Design Decisions")

Every design decision in this sprint was made to reduce friction for students while keeping
the system maintainable and upgradeable. The table below documents each key decision and its
rationale.

#table(
  columns: (0.38fr, 0.62fr),
  fill: (_, row) => if row == 0 { ink } else if calc.odd(row) { white } else { surface },
  stroke: (_, y) => if y > 0 { (bottom: 0.5pt + border) } else { none },
  inset: (x: 11pt, y: 9pt),
  align: (left, left),

  table.header(
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, tracking: 0.04em, "Decision"),
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, tracking: 0.04em, "Rationale"),
  ),

  [*Drag-and-drop interaction* \ #text(font: sans, size: 8pt, fill: muted)[(not click-to-assign)]],
  [Maps to the mental model of a physical degree planning sheet. Students spatially think about courses — dragging is more natural and faster than three-dropdown forms.],

  [*API-side scoring* \ #text(font: sans, size: 8pt, fill: muted)[(not client-side)]],
  [Keeps business logic server-authoritative and testable. When the AI key is eventually set, the same endpoint can switch to AI-powered scoring without any frontend change.],

  [*Unit-weighted overlap scoring* \ #text(font: sans, size: 8pt, fill: muted)[(not raw course count)]],
  [A 4-unit core course signals much stronger subject commitment than a 1-unit seminar. Counting units rather than courses produces a more accurate match signal, especially in Year 1 where course loads vary.],

  [*Show top 3 tracks* \ #text(font: sans, size: 8pt, fill: muted)[(not just the \#1 pick)]],
  [Students at the end of Year 1 often have mixed interests. Showing three options lets them compare, read the reason text, and make an informed decision rather than accepting a single opaque recommendation.],

  [*Banner auto-appears* \ #text(font: sans, size: 8pt, fill: muted)[(not button-triggered)]],
  [Zero-friction discovery. A student focused on filling in their course grid should not need to find a separate "Get recommendations" button. Passive surfacing increases engagement.],

  [*Triggered on ≥1 Year 1 course* \ #text(font: sans, size: 8pt, fill: muted)[(not after full Year 1)]],
  [Immediate feedback as the student builds the plan. Even a single Year 1 course creates a signal worth surfacing. Students can watch rankings shift as they add more courses.],

  [*Confirmation modal* \ #text(font: sans, size: 8pt, fill: muted)[(not direct one-click select)]],
  [Track selection is consequential — it may be gate-locked after selection and triggers downstream approval workflows. A modal with full track details prevents accidental commits.],

  [*Banner hidden after track selected* \ #text(font: sans, size: 8pt, fill: muted)[(not always visible)]],
  [Reduces cognitive noise. Once a decision is made, showing recommendations again is distracting. The student can always visit /planner/track to review or change.],

  [*Separate `planner.module.css`* \ #text(font: sans, size: 8pt, fill: muted)[(not appended to shared CSS)]],
  [The planner grid styles are highly specific. Isolating them prevents accidental side effects on instructor and admin pages that share the common module.],

  [*No new Prisma schema changes*],
  [The recommendation endpoint is purely computational — it reads existing data and returns a scored result. Zero migration risk, zero DB downtime.],
)


// ─────────────────────────────────────────────────────────
//  4. HOW THE ALGORITHM WORKS
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("4", "How the Recommendation Algorithm Works")

== 4a — Overview

The engine is a *pure server-side computation* — no machine learning, no external AI API, no
trained model. It uses _unit-weighted requirement overlap_: for each available track, it
measures how many of the student's Year 1 course units land inside that track's required course
list, then expresses this as a percentage of the track's total required units.

#callout(color: amber, title: "Why \"unit-weighted\"?")[
  A 4-unit core course and a 1-unit seminar both count as "1 course" in a naive counter —
  but the 4-unit course represents four times the academic commitment. Weighting by units
  makes the signal proportional to actual study investment.
]

== 4b — Step-by-Step Algorithm

#v(0.4em)
#flow-step("1", "Fetch the student plan",
  [Load from `GET /v1/programs/student/me`. Extract all `plannedCourses` where `plannedYear === 1`. If none exist, return an empty recommendations array immediately.])
#v(0.5em)
#flow-step("2", "Build a unit lookup map",
  [Create a `Map<catalogCourseId, defaultUnits>` from the plan's `catalogCourses` array for O(1) unit lookups.])
#v(0.5em)
#flow-step("3", "Collect required courses per track",
  [Find all `requirementGroups` where `group.trackId === track.id`. Walk each group's rules and courses to build a `Set<catalogCourseId>` of requirements for this track.])
#v(0.5em)
#flow-step("4", "Score the overlap",
  [`totalTrackUnits` = sum of units for all courses in the required set. `matchedUnits` = sum of units of Year 1 courses in the required set. `matchScore = round(matchedUnits / totalTrackUnits × 100)`.])
#v(0.5em)
#flow-step("5", "Generate a reason string",
  [Plain-English message based on `matchedCourseCount` and `matchedUnits`, e.g. _"3 of your Year 1 courses (11 units) align with this track's core requirements."_])
#v(0.5em)
#flow-step("6", "Sort & return top 3",
  [Sort all tracks by `matchScore` descending. Slice top 3. Return as `TrackRecommendationResponse`.])

== 4c — Worked Example with Real Data

The following example uses the actual CS program data from the Nibras production database and
the real Year 1 plan of the test account `shahahahahahahd`.

#block(radius: 8pt, stroke: 0.5pt + border, clip: true, width: 100%)[
  #block(width: 100%, inset: (x: 14pt, y: 10pt), fill: ink)[
    #text(font: sans, size: 9pt, weight: "bold", fill: white,
      "📚  Student's Year 1 Planned Courses")
  ]
  #block(width: 100%, inset: 14pt)[
    #table(
      columns: (auto, 1fr, auto, auto),
      fill: (_, row) => if row == 0 { ink } else if calc.odd(row) { white } else { surface },
      stroke: (_, y) => if y > 0 { (bottom: 0.5pt + border) } else { none },
      inset: (x: 9pt, y: 7pt),
      table.header(
        text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Course"),
        text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Title"),
        text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Units"),
        text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Term"),
      ),
      [CS 101],    [Programming Fundamentals], [4],    [Fall],
      [CS 102],    [Data Structures],          [4],    [Fall],
      [CS 103],    [Discrete Mathematics],     [3],    [Spring],
      [MATH 111],  [Calculus I],               [3],    [Spring],
      table.cell(colspan: 2)[*Total Year 1 units*], [*14*], [],
    )
  ]
]

#v(0.6em)

=== Scoring Each Track

#match-box(
  "Track A — Artificial Intelligence (AI)",
  (
    match-row(true,  "CS 101 Programming Fundamentals — 4 units matched"),
    match-row(true,  "CS 102 Data Structures — 4 units matched"),
    match-row(true,  "CS 103 Discrete Mathematics — 3 units matched"),
    match-row(false, "MATH 111 Calculus I — not in AI track requirements"),
  ),
  [matchedUnits = 11 · totalTrackUnits ≈ 32 · score = ⌊11/32 × 100⌋ = #text(fill: accent)[34%]],
)
#v(0.5em)

#match-box(
  "Track B — Theory",
  (
    match-row(true,  "CS 101 Programming Fundamentals — 4 units matched"),
    match-row(false, "CS 102 Data Structures — not in Theory track requirements"),
    match-row(true,  "CS 103 Discrete Mathematics — 3 units matched"),
    match-row(true,  "MATH 111 Calculus I — 3 units matched"),
  ),
  [matchedUnits = 10 · totalTrackUnits ≈ 30 · score = ⌊10/30 × 100⌋ = #text(fill: accent)[33%]],
)
#v(0.5em)

#match-box(
  "Track C — Systems",
  (
    match-row(true,  "CS 101 Programming Fundamentals — 4 units matched"),
    match-row(true,  "CS 102 Data Structures — 4 units matched"),
    match-row(false, "CS 103 Discrete Mathematics — not in Systems track requirements"),
    match-row(false, "MATH 111 Calculus I — not in Systems track requirements"),
  ),
  [matchedUnits = 8 · totalTrackUnits ≈ 28 · score = ⌊8/28 × 100⌋ = #text(fill: accent)[29%]],
)

#v(0.6em)

=== What the Student Sees

#block(radius: 8pt, stroke: 0.5pt + border, clip: true, width: 100%)[
  #block(width: 100%, inset: (x: 14pt, y: 10pt), fill: ink)[
    #text(font: sans, size: 9pt, weight: "bold", fill: white,
      "🎯  Recommendation Banner — rendered result")
  ]
  #block(width: 100%, inset: 14pt)[
    #track-card("1", "Artificial Intelligence (AI)",
      "3 of your Year 1 courses (11 units) align with this track's core requirements.", 34)
    #v(0.5em)
    #track-card("2", "Theory",
      "3 of your Year 1 courses (10 units) align with this track's core requirements.", 33)
    #v(0.5em)
    #track-card("3", "Systems",
      "2 of your Year 1 courses (8 units) align with this track's core requirements.", 29)
  ]
]

== 4d — Why Unit-Weighting Beats Course-Counting

#table(
  columns: (1.4fr, 0.75fr, 0.75fr, 1fr),
  fill: (_, row) => if row == 0 { ink } else if calc.odd(row) { white } else { surface },
  stroke: (_, y) => if y > 0 { (bottom: 0.5pt + border) } else { none },
  inset: (x: 9pt, y: 8pt),
  table.header(
    text(font: sans, size: 8pt, weight: "bold", fill: white, "Scenario"),
    text(font: sans, size: 8pt, weight: "bold", fill: white, "Course-Count"),
    text(font: sans, size: 8pt, weight: "bold", fill: white, "Unit-Weighted"),
    text(font: sans, size: 8pt, weight: "bold", fill: white, "Result"),
  ),
  [One 4-unit AI core + three 1-unit seminars], [4/10 = 40%], [4/32 = 13%],
    [✅ Unit score correctly shows shallow coverage],
  [Four 4-unit AI core courses],               [4/10 = 40%], [16/32 = 50%],
    [✅ Unit score correctly shows deep commitment],
  [One 4-unit Theory + one 1-unit seminar],    [2/8 = 25%],  [4/30 = 13%],
    [✅ Unit score rewards the substantive course],
)


// ─────────────────────────────────────────────────────────
//  5. API REFERENCE
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("5", "API Reference")

#table(
  columns: (1.5fr, 0.4fr, 1.6fr),
  fill: (_, row) => if row == 0 { ink } else if calc.odd(row) { white } else { surface },
  stroke: (_, y) => if y > 0 { (bottom: 0.5pt + border) } else { none },
  inset: (x: 10pt, y: 8pt),
  table.header(
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Endpoint"),
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Method"),
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Description"),
  ),
  [`/v1/programs/student/me`], [`GET`],
    [Full student plan — tracks, requirement groups, planned courses, catalog courses, approvals.],
  [`/v1/programs/student/me/plan`], [`PATCH`],
    [Save the full `plannedCourses` array. Accepts year, term, sourceType per course.],
  [#text(fill: accent, weight: "bold")[`/v1/programs/student/me/recommend-track`]], [`GET`],
    [*NEW* — Returns top 3 tracks ranked by unit-weighted Year 1 overlap. Response includes `recommendations[]` and `year1CourseCount`.],
  [`/v1/programs/student/me/select-track`], [`POST`],
    [Confirm a track selection. Body: `{ trackId }`. Returns updated plan. 409 if gate is locked.],
  [`/v1/programs/student/me/sheet`], [`GET`],
    [Printable program sheet with matched courses, petitions, and approvals.],
  [`/v1/programs/student/me/petitions`], [`GET / POST`],
    [List or submit transfer credit, substitution, or waiver petitions.],
)

#v(0.6em)

== New Response Schema — TrackRecommendationResponse

#block(
  width: 100%, inset: (x: 18pt, y: 16pt), radius: 7pt, fill: ink,
)[
  #text(font: mono, size: 8.5pt, fill: rgb("#e2e8f0"))[
    ```
{
  "recommendations": [
    {
      "trackId":            "cmo9snosb0040u5ho30gcn0d0",
      "trackTitle":         "Artificial Intelligence (AI)",
      "trackSlug":          "artificial-intelligence-ai",
      "trackDescription":   "Focused depth path for AI and ML.",
      "matchScore":         34,
      "matchedUnits":       11,
      "totalTrackUnits":    32,
      "matchedCourseCount": 3,
      "reason": "3 of your Year 1 courses (11 units) align
                 with this track's core requirements."
    }
    // ... up to 3 entries
  ],
  "year1CourseCount": 4
}
    ```
  ]
]


// ─────────────────────────────────────────────────────────
//  6. DEPLOYMENT
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("6", "Deployment")

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 14pt,
  block(inset: 16pt, radius: 8pt, stroke: 0.5pt + border, width: 100%)[
    #align(center)[
      #text(size: 20pt, "🌐") #v(0.3em)
      #text(font: sans, size: 10pt, weight: "bold", "Web") #v(0.2em)
      #text(font: sans, size: 8pt, fill: accent, "nibras-web.fly.dev") #v(0.2em)
      #text(font: sans, size: 8pt, fill: muted, "Next.js 15 · 512 MB") #v(0.4em)
      #status-badge("✅  Live")
    ]
  ],
  block(inset: 16pt, radius: 8pt, stroke: 0.5pt + border, width: 100%)[
    #align(center)[
      #text(size: 20pt, "⚡") #v(0.3em)
      #text(font: sans, size: 10pt, weight: "bold", "API") #v(0.2em)
      #text(font: sans, size: 8pt, fill: accent, "nibras-api.fly.dev") #v(0.2em)
      #text(font: sans, size: 8pt, fill: muted, "Fastify · 1 GB") #v(0.4em)
      #status-badge("✅  Live")
    ]
  ],
  block(inset: 16pt, radius: 8pt, stroke: 0.5pt + border, width: 100%)[
    #align(center)[
      #text(size: 20pt, "⚙️") #v(0.3em)
      #text(font: sans, size: 10pt, weight: "bold", "Worker") #v(0.2em)
      #text(font: sans, size: 8pt, fill: accent, "internal only") #v(0.2em)
      #text(font: sans, size: 8pt, fill: muted, "Node.js · 1 GB") #v(0.4em)
      #status-badge("✅  Live")
    ]
  ],
)
#v(0.6em)

#table(
  columns: (0.35fr, 0.65fr),
  fill: (_, row) => if row == 0 { ink } else if calc.odd(row) { white } else { surface },
  stroke: (_, y) => if y > 0 { (bottom: 0.5pt + border) } else { none },
  inset: (x: 11pt, y: 8pt),
  table.header(
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Detail"),
    text(font: sans, size: 8.5pt, weight: "bold", fill: white, "Value"),
  ),
  [Cloud provider],    [Fly.io],
  [Region],            [IAD (us-east)],
  [Deploy method],     [All three apps deployed in parallel via `fly deploy --config fly.*.toml`],
  [Config files],      [`fly.api.toml` · `fly.web.toml` · `fly.worker.toml`],
  [Build args (web)],  [`NEXT_PUBLIC_NIBRAS_API_BASE_URL=https://nibras-api.fly.dev`],
  [Health check],      [`GET /healthz` → `{"ok":true}`],
  [Auto-stop],         [Enabled — machines stop when idle, start on first request],
)

== Commits Delivered

#block(
  width: 100%, inset: 14pt, radius: 8pt, fill: surface, stroke: 0.5pt + border,
)[
  #grid(
    columns: (auto, 1fr),
    column-gutter: 12pt,
    row-gutter: 10pt,
    box(inset: (x: 8pt, y: 3pt), radius: 4pt, fill: ink)[
      #text(font: mono, size: 8.5pt, fill: rgb("#a5b4fc"), "54b5b62")
    ],
    text(font: sans, size: 9pt,
      "Add drag-and-drop course planner UI — visual 4-year × 2-term grid with palette sidebar, unit totals, and locked-plan state"),

    box(inset: (x: 8pt, y: 3pt), radius: 4pt, fill: ink)[
      #text(font: mono, size: 8.5pt, fill: rgb("#a5b4fc"), "9666d2d")
    ],
    text(font: sans, size: 9pt,
      "Add track recommendation system after Year 1 course placement — API endpoint, scoring engine, banner, and confirmation modal"),
  )
]


// ─────────────────────────────────────────────────────────
//  7. WHAT COULD COME NEXT
// ─────────────────────────────────────────────────────────
#pagebreak()

#section-label("7", "What Could Come Next")

#let roadmap-item(icon, title, desc) = block(
  width: 100%, inset: 14pt, radius: 7pt, stroke: 0.5pt + border,
)[
  #grid(
    columns: (22pt, 1fr),
    gutter: 10pt,
    align: top,
    text(size: 14pt, icon),
    stack(spacing: 4pt,
      text(font: sans, size: 10pt, weight: "bold", title),
      text(font: sans, size: 9pt, fill: muted, desc),
    ),
  )
]

#roadmap-item("☀️", "Summer Term Support",
  "Add 'summer' to the AcademicTerm enum in Prisma and contracts. The grid gains a third row per year. One migration, one schema change, no API rework.")
#v(0.4em)

#roadmap-item("🤖", "AI-Powered Recommendations",
  "The /recommend-track endpoint already exists. When NIBRAS_AI_API_KEY is set, the route can call the OpenAI-compatible grading service (already in packages/grading) instead of the scoring engine — returning richer, natural-language reasons. Zero frontend changes needed.")
#v(0.4em)

#roadmap-item("🔗", "Prerequisite Chain Validation",
  "Add a prerequisites relation to CatalogCourse in the Prisma schema. When a student places a course before its prerequisite, a warning chip appears on the cell. Pure client-side check using the catalog data already loaded.")
#v(0.4em)

#roadmap-item("📈", "GPA & Grade Tracking",
  "Add an optional expectedGrade field to StudentPlannedCourse. Chips in the grid show a small grade badge. A GPA projection row appears below the unit totals row.")
#v(0.4em)

#roadmap-item("📄", "Direct PDF Export",
  "The /planner/sheet page already has a Print button. Adding @media print styles to render the grid cleanly (without DnD interactivity) would make it a true one-click PDF export — no server-side rendering needed.")
#v(0.4em)

#roadmap-item("📱", "Mobile Drag Improvement",
  "The current PointerSensor from @dnd-kit works on touch, but a dedicated TouchSensor with scroll tolerance would make the grid feel native on phones. A two-tap alternative (tap to pick, tap to place) provides a fallback.")

#v(2.5em)
#line(length: 100%, stroke: 0.5pt + border)
#v(0.6em)
#align(center)[
  #text(font: sans, size: 8pt, fill: muted,
    "Nibras Platform · Student Planner Feature Report · April 22, 2026 · nibras-web.fly.dev")
]
