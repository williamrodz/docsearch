# DocSearch - Historical Document Analysis Platform

A web application for analyzing scanned historical church documents (baptisms, marriages, deaths) using AI-powered OCR to extract names, dates, and text from handwritten Spanish cursive records.

## Project Overview

**Purpose**: Find specific ancestors within a corpus of ~800-2000 scanned church document images that haven't been OCR'd. The documents are 19th century Spanish cursive handwriting with varying legibility.

**Target Users**: Genealogy researchers working with historical Puerto Rican church records.

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ (App Router) | Full-stack React with API routes, SSR, excellent TypeScript support |
| Language | TypeScript | Type safety for complex data structures |
| Database | Supabase PostgreSQL | Managed database with real-time capabilities |
| Storage | Supabase Storage | S3-compatible, integrated with auth |
| Vision AI | Claude API (claude-sonnet-4-20250514) | Excellent at handwriting recognition, Spanish, nuanced extraction |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible components |
| State | Zustand or React Context | Lightweight state management |
| Image Viewer | OpenSeadragon or react-zoom-pan-pinch | Smooth zoom/pan for document inspection |

## Database Schema

```sql
-- Users (no passwords, just identification)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Image groups/collections
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Individual images
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMPTZ,

  -- Extracted data
  raw_text TEXT,
  confidence_score FLOAT, -- 0-1 overall confidence
  alternatives JSONB, -- Array of {text: string, confidence: number} for uncertain passages
  event_date DATE,
  event_date_raw TEXT, -- Original text of date
  event_date_confidence FLOAT,

  UNIQUE(group_id, filename)
);

-- People mentioned in images
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL, -- Lowercase, accents removed for matching
  role TEXT, -- 'baptized', 'parent', 'godparent', 'priest', 'witness', etc.
  confidence FLOAT,
  alternatives JSONB, -- [{name: string, confidence: number}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical people (for grouping similar names)
CREATE TABLE canonical_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  variant_names TEXT[], -- All spelling variations
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link people to canonical records
CREATE TABLE people_canonical_link (
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  canonical_id UUID REFERENCES canonical_people(id) ON DELETE CASCADE,
  match_score FLOAT,
  PRIMARY KEY (person_id, canonical_id)
);

-- Inspection records
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- User's last viewed position per group
CREATE TABLE user_group_position (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  last_image_id UUID REFERENCES images(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- Indexes for performance
CREATE INDEX idx_images_group ON images(group_id);
CREATE INDEX idx_images_processing ON images(processing_status);
CREATE INDEX idx_people_image ON people(image_id);
CREATE INDEX idx_people_normalized ON people(name_normalized);
CREATE INDEX idx_inspections_image ON inspections(image_id);
CREATE INDEX idx_canonical_group ON canonical_people(group_id);
```

## Core Features

### 1. Group Management
- Create named groups for collections
- Upload multiple images via drag-and-drop or file picker
- Images automatically assigned filename as identifier
- Progress indicator during upload

### 2. AI Processing Pipeline

**Batch Processing**:
- Default batch size: 20 images
- User-configurable: 1, 5, 10, 20, 50 images per batch
- Background processing with progress tracking
- Retry logic for failed images

**Claude Vision Prompt Strategy**:
```
You are analyzing a historical church document from Puerto Rico (1806-1830).
The document contains handwritten Spanish cursive text recording baptisms.

Extract the following information:

1. RAW_TEXT: Transcribe all visible text, preserving line breaks. For unclear
   text, use [?word?] notation. For completely illegible sections, use [...].

2. CONFIDENCE: Rate overall legibility 0-100%.

3. ALTERNATIVES: For any [?word?] sections, provide up to 3 alternative readings
   with confidence percentages.

4. PEOPLE: List all people mentioned with their roles:
   - Format: {"name": "...", "role": "baptized|parent|godparent|priest|witness", "confidence": 0-100}
   - Include alternative spellings if uncertain

5. EVENT_DATE: Extract the date of the recorded event
   - Format: {"date": "YYYY-MM-DD", "raw": "original text", "confidence": 0-100}

Respond in JSON format only.
```

### 3. Name Matching Algorithm

**Combined Approach**:
1. **Jaro-Winkler Distance** (primary): Good for names, weighs prefix matches
2. **Double Metaphone** (secondary): Phonetic matching for Spanish names
3. **Threshold**: Names with combined score > 0.85 are suggested as matches

```typescript
// Name matching utility
interface NameMatch {
  name1: string;
  name2: string;
  jaroWinkler: number;
  phonetic: boolean;
  combinedScore: number;
}

function matchNames(name1: string, name2: string): NameMatch {
  const jw = jaroWinkler(normalize(name1), normalize(name2));
  const phonetic = doubleMetaphone(name1) === doubleMetaphone(name2);
  const combinedScore = phonetic ? Math.min(jw + 0.1, 1) : jw;
  return { name1, name2, jaroWinkler: jw, phonetic, combinedScore };
}
```

### 4. Ambiguity Handling

**Confidence Visualization**:
- High confidence (>80%): Normal text
- Medium confidence (50-80%): Yellow highlight
- Low confidence (<50%): Red highlight with alternatives shown on hover

**UI for Corrections**:
- Click on any name/date to edit
- Dropdown shows AI alternatives
- "Accept" / "Edit manually" buttons
- Changes logged with user attribution

### 5. Image Viewer

**Desktop**:
- Left/Right arrow keys to navigate
- Mouse wheel zoom, click-drag pan
- Sidebar with metadata (collapsible)
- "Mark as inspected" button (keyboard shortcut: Enter or Space)

**Mobile**:
- Swipe left/right to navigate
- Pinch zoom, drag pan
- Bottom sheet for metadata
- Large "Mark Inspected" button

**Library**: `react-zoom-pan-pinch` for cross-platform gesture support

### 6. Search System

**Full-text search across**:
- Raw transcribed text
- People names
- Dates

**UI**:
- Search bar at top of group page
- Results show: image thumbnail | matched text | people | date
- Click result to open image viewer at that image

**Implementation**: PostgreSQL full-text search with Spanish dictionary
```sql
CREATE INDEX idx_images_text_search ON images
  USING gin(to_tsvector('spanish', raw_text));
```

### 7. Multi-User Support

**Simple user switching**:
- Dropdown in header to select/create user
- No authentication (per requirements)
- User stored in localStorage for persistence
- All actions attributed to current user

**Resume feature**:
- Track last viewed image per user per group
- "Resume Inspection" button shows on group page

## UI/UX Design Guidelines

**Design System**:
- Clean, minimal interface with ample whitespace
- Primary color: Deep blue (#1e3a5f) - professional, archival feel
- Accent: Warm gold (#d4a84b) - evokes historical documents
- Neutral grays for text and backgrounds
- shadcn/ui components for consistency

**Layout**:
- Groups list: Card grid layout
- Group detail: Three sections (Search, People, Dates) as collapsible accordions
- Image viewer: Full-screen with floating controls

**Typography**:
- Inter for UI text
- Source Serif Pro for document transcriptions (readability)

## File Structure

```
docsearch/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home - list of groups
│   ├── groups/
│   │   ├── new/page.tsx            # Create group
│   │   └── [groupId]/
│   │       ├── page.tsx            # Group detail (search, people, dates)
│   │       ├── upload/page.tsx     # Upload images
│   │       ├── process/page.tsx    # Process images
│   │       └── view/
│   │           └── [imageId]/page.tsx  # Image viewer
│   └── api/
│       ├── groups/route.ts
│       ├── images/route.ts
│       ├── process/route.ts        # AI processing endpoint
│       ├── search/route.ts
│       └── users/route.ts
├── components/
│   ├── ui/                         # shadcn components
│   ├── ImageViewer.tsx
│   ├── ImageGrid.tsx
│   ├── PeopleList.tsx
│   ├── DatesList.tsx
│   ├── SearchResults.tsx
│   ├── ProcessingQueue.tsx
│   ├── UserSwitcher.tsx
│   └── InspectionBadge.tsx
├── lib/
│   ├── supabase.ts                 # Supabase client
│   ├── claude.ts                   # Claude API wrapper
│   ├── name-matching.ts            # Jaro-Winkler + Metaphone
│   ├── normalize.ts                # Text normalization
│   └── types.ts                    # TypeScript types
├── hooks/
│   ├── useImageNavigation.ts
│   ├── useZoomPan.ts
│   └── useKeyboardShortcuts.ts
└── public/
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development Phases

### Phase 1: Foundation
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Supabase project and schema
- [ ] Create basic UI layout with shadcn/ui
- [ ] Implement user switching

### Phase 2: Image Management
- [ ] Group creation and listing
- [ ] Image upload with drag-and-drop
- [ ] Image grid view with thumbnails
- [ ] Basic image viewer with zoom/pan

### Phase 3: AI Processing
- [ ] Claude Vision integration
- [ ] Batch processing with queue
- [ ] Progress tracking UI
- [ ] Error handling and retries

### Phase 4: Data Display
- [ ] Raw text display with confidence highlighting
- [ ] People extraction and tag display
- [ ] Date extraction and display
- [ ] Edit/correction UI

### Phase 5: Name Matching
- [ ] Implement Jaro-Winkler algorithm
- [ ] Implement Double Metaphone
- [ ] Build canonical people grouping
- [ ] People list with collapsible image references

### Phase 6: Search & Navigation
- [ ] Full-text search implementation
- [ ] Search results UI
- [ ] Keyboard navigation
- [ ] Mobile swipe gestures
- [ ] "Resume inspection" feature

### Phase 7: Polish
- [ ] Inspection tracking
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Visual design refinement

## Sample Document Analysis

Based on sample images from `/Users/williama/Downloads/Bautismos 1806-1830 (Image 1426 to 2529)/`:

**Document characteristics**:
- Two-page spreads of bound ledger books
- Multiple baptism entries per page
- Cursive Spanish handwriting
- Priest signatures (recurring: "Fran. Castañon")
- Page numbers in corners
- Water damage/staining near binding
- Marginal annotations
- Date range: 1806-1830
- ~807 images in collection

**Expected fields per entry**:
- Date of baptism
- Name of baptized person
- Parents' names
- Godparents' names
- Legitimacy status
- Parish name
- Priest signature

## API Costs Estimate

Claude API (claude-sonnet-4-20250514) for 800 images:
- ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
- Estimated ~2000 input tokens per image (image + prompt)
- Estimated ~500 output tokens per response
- **Total estimate**: ~$10-15 for full corpus processing

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database migrations (via Supabase CLI)
supabase db push

# Type generation from database
supabase gen types typescript --local > lib/database.types.ts
```

## Notes

- Images are scanned church records from Puerto Rico, 1806-1830
- Primary use case: Finding specific ancestor names
- Documents contain baptism records with names, dates, relationships
- Handwriting quality varies; AI must handle ambiguity gracefully
- Multi-user support without authentication (trusted environment)
