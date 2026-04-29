# UniNMS OAI-PMH Harvester

Automatically imports article metadata from Nigerian institutional journals
into UniNMS using the OAI-PMH standard protocol.

## How it works

Most Nigerian journals built on Open Journal Systems (OJS) expose a standard
OAI-PMH endpoint. This harvester connects to that endpoint, pulls all article
metadata (title, abstract, authors, keywords, DOI), and imports it directly
into your UniNMS database.

## Setup

Make sure your UniNMS backend is running first, then:

```
cd uninms-harvest
npm install
node harvest.js
```

## Pre-configured journals

| Journal | University | OAI Endpoint |
|---------|------------|--------------|
| Kashere Journal of Science & Education | Federal University of Kashere | kasherejose.ng |
| Kashere Journal of Geography | Federal University of Kashere | kasherejgse.com.ng |

## Add more journals

Open `harvest.js` and add entries to the `SOURCES` array:

```javascript
{
  id:         'unn_njss',
  name:       'Nigerian Journal of Social Sciences',
  shortName:  'NJSS',
  university: 'University of Nigeria Nsukka',
  oaiUrl:     'https://their-journal-url/index.php/journal-path/oai',
  docType:    'research_paper',
},
```

## Finding the OAI URL for any OJS journal

For any OJS journal, the OAI endpoint follows this pattern:
```
https://journal-domain.com/index.php/journal-abbreviation/oai
```

Test it by visiting the URL in your browser. If you see XML starting with
`<OAI-PMH>`, it works.

## Commands

```bash
node harvest.js                    # harvest all configured journals
node harvest.js --source kashere_jose  # harvest one specific journal
node verify.js                     # check how many records were imported
```

## What gets imported

- Title
- Abstract
- Keywords → saved as searchable tags
- DOI
- Source URL (link back to original journal)
- Published date
- Authors (stored in document notes)

Documents are marked as published and publicly visible immediately.
Duplicates are detected by title + DOI and skipped automatically.
Re-running is safe — it will not create duplicates.

## Other Nigerian journals to add

These also run OJS and likely have OAI-PMH:
- Nigerian Journals Online (njol.com.ng) — aggregator with 100+ journals
- African Journals Online (ajol.info) — largest African journal aggregator
- Open Journals Nigeria (openjournalsnigeria.org.ng)

For AJOL specifically, their OAI endpoint is:
```
https://www.ajol.info/index.php/ajol/oai
```
This alone would import thousands of Nigerian academic papers.
