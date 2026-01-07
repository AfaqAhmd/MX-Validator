# 📧 Lead List MX Validator

> **The Open-Source Lead Magnet for Email Agencies**

Built by **Jesse Ouellette** of [LeadMagic](https://leadmagic.io) for the **IGNITE Cymate GTM Engineering Competition**.

Validate email deliverability by checking MX records for your lead lists. Upload a CSV and instantly identify which domains have valid mail servers.

![MX Validator Demo](demo/mx-validator-demo.gif)

## ✨ Features

- 🚀 **High-Speed Scanning** - Fast concurrent MX lookups
- 📊 **Visual Analytics** - Charts showing deliverability rates and quality scores
- 🛡️ **Security Gateway Detection** - Identifies Proofpoint, Mimecast, Barracuda, etc.
- 📧 **Email Provider Detection** - Google Workspace, Microsoft 365, Zoho, and more
- 📈 **Real-time Progress** - Live scanning updates
- 📁 **CSV Export** - Download results with full details
- 🎨 **Modern UI** - Dark theme, responsive design

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database ([Neon](https://neon.tech) free tier works great)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/lead-list-mx-validator.git
cd lead-list-mx-validator

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Set up database
pnpm db:push

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📝 Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

## 📊 Usage

1. **Upload CSV** - Drag & drop your lead list (must have `email` column)
2. **Scan** - Watch real-time progress as domains are validated
3. **Analyze** - View charts and insights
4. **Export** - Download enriched CSV with MX data

## 🌐 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add `DATABASE_URL` environment variable
4. Deploy

## 📄 License

MIT License

---

Made with 🔥 by [Jesse Ouellette](https://leadmagic.io) for the IGNITE Cymate GTM Engineering Competition
