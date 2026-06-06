# Paper Forge Question Data

Keep these files and folders:

- `questions.1000plus.json` - combined import file for MongoDB.
- `question-bank/index.json` - catalog/index of generated classes, subjects, and chapters.
- `question-bank/9th`, `question-bank/10th`, `question-bank/1st-year`, `question-bank/2nd-year` - chapter-wise JSON files.

The app generates papers from MongoDB at runtime. To load or refresh MongoDB from these files, run:

```bash
npm run seed:questions
```

`seed:questions` first rebuilds `questions.1000plus.json` from all chapter-wise files inside `question-bank`, then imports that combined file into MongoDB.

Paper generation and MCQ practice also auto-sync the selected chapter file before fetching questions. For example, selecting `2nd Year -> Math -> Differentiation` syncs:

```text
question-bank/2nd-year/math/differentiation.json
```

That chapter file becomes the source of truth for that class, subject, and chapter.

When more than one chapter is selected for a custom paper, Paper Forge selects questions chapter-by-chapter in a balanced round-robin order for each type. For example, selecting `Basic Concepts` and `Atomic Structure` for 10 MCQs gives questions from both chapters instead of taking everything from only one chapter.

Full Paper mode always targets a complete paper of `100 MCQs`, `50 short questions`, and `20 long questions`. These totals are distributed across the selected chapters instead of being multiplied per chapter.

To rebuild only the combined JSON file from the chapter folders:

```bash
npm run build:questions
```

Use `npm run generate:questions` only when you intentionally want to regenerate the sample/generated question bank from code. It can overwrite chapter-wise JSON files.
