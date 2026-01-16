/**
 * Faculty Data Fetcher
 * Uses Playwright to scrape faculty data from IIIT Kottayam website
 * Run with: node scripts/fetch-faculty.mjs
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const FACULTY_URL = 'https://www.iiitkottayam.ac.in/#!/faculty'
const OUTPUT_PATH = join(__dirname, '..', 'data', 'faculty.ts')

// top faculty IDs - manually curated (update as needed)
const TOP_FACULTY_IDS = [
  'prof-ashok-s',
  'dr-shajulin-benedict',
  'dr-ebin-deni-raj',
  'dr-p-victer-paul',
  'dr-divya-sindhu-lekha',
]

// generate id from name
const generateId = (name) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// parse email from obfuscated format
const parseEmail = (text) => {
  if (!text) return null
  // "pic.academics at iiitkottayam dot ac.in" -> "pic.academics@iiitkottayam.ac.in"
  return text
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+/g, '')
}

// extract room number
const parseRoom = (text) => {
  if (!text) return null
  const match = text.match(/Room\s*No[:\s]*([A-Z0-9\s]+)/i)
  const room = match ? match[1].trim() : text.trim()
  // filter out empty or invalid room numbers
  if (!room || room === 'Room No:' || room.length < 2) return null
  return room
}

// fix page link
const fixPageLink = (link) => {
  if (!link) return null
  // remove double prefix
  if (link.includes('http://') || link.includes('https://')) {
    // extract actual URL
    const httpMatch = link.match(/(https?:\/\/[^\s]+)/)
    if (httpMatch) return httpMatch[1]
  }
  if (link.startsWith('#!')) {
    return `https://www.iiitkottayam.ac.in/${link}`
  }
  return `https://www.iiitkottayam.ac.in/${link}`
}

async function fetchFaculty() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  FACULTY DATA FETCHER                ║')
  console.log('╚══════════════════════════════════════╝')
  console.log()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    console.log('[1] Loading faculty page...')
    await page.goto(FACULTY_URL, { waitUntil: 'networkidle', timeout: 60000 })

    // wait for Angular to render
    console.log('[2] Waiting for Angular to render...')
    await page.waitForSelector('.custom-card-header', { timeout: 30000 })

    // scroll to load all faculty cards
    console.log('[3] Scrolling to load all faculty...')
    let prevCount = 0
    let currentCount = 0
    let scrollAttempts = 0
    const maxScrollAttempts = 20

    do {
      prevCount = currentCount
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
      currentCount = await page.locator('.custom-card-header').count()
      scrollAttempts++
      console.log(`    Scroll ${scrollAttempts}: Found ${currentCount} faculty cards`)
    } while (currentCount > prevCount && scrollAttempts < maxScrollAttempts)

    console.log(`[4] Extracting data from ${currentCount} faculty cards...`)

    // extract faculty data
    const faculties = await page.evaluate(() => {
      const cards = document.querySelectorAll('.col.s12.m6.flex.ng-scope')
      const result = []

      cards.forEach(card => {
        try {
          // name
          const nameEl = card.querySelector('.custom-card-header h5')
          const name = nameEl?.textContent?.trim() || ''
          if (!name) return

          // additional role (Professor In-charge, etc)
          const subHeads = card.querySelectorAll('.custom-card-sub-head')
          let additionalRole = null
          let designation = ''
          let qualification = null

          subHeads.forEach((el, idx) => {
            const text = el.textContent?.trim() || ''
            if (idx === 0 && text.includes('Professor In-charge') || text.includes('Former')) {
              additionalRole = text.replace(/\s+/g, ' ')
            } else if (idx === 0 || idx === 1) {
              if (!text.includes('PhD') && !text.includes('M.Tech') && !text.includes('B.Tech')) {
                designation = text
              }
            }
            // last sub-head usually has qualification
            if (text.includes('PhD') || text.includes('Institute') || text.includes('University')) {
              qualification = text.replace(/\s+/g, ' ')
            }
          })

          // image
          const imgEl = card.querySelector('.custom-image')
          const imgSrc = imgEl?.getAttribute('src') || null
          const imageUrl = imgSrc ? `https://www.iiitkottayam.ac.in/${imgSrc}` : null

          // areas of expertise
          const areaEls = card.querySelectorAll('li.ng-scope')
          const areas = []
          areaEls.forEach(el => {
            const text = el.textContent?.trim()
            if (text) areas.push(text)
          })

          // contact info
          const chips = card.querySelectorAll('.chip')
          let phone = null
          let email = null
          let room = null
          let pageText = null
          let pageLink = null

          chips.forEach(chip => {
            const icon = chip.querySelector('i')?.textContent?.trim()
            const text = chip.textContent?.replace(icon || '', '').trim()

            if (icon === 'contact_phone') {
              phone = text
            } else if (icon === 'email') {
              email = text
            } else if (icon === 'location_on') {
              room = text
            } else if (icon === 'insert_link') {
              const link = chip.querySelector('a')
              pageText = link?.textContent?.trim() || 'Visit Page'
              pageLink = link?.getAttribute('href') || null
            }
          })

          result.push({
            name,
            designation,
            additionalRole,
            qualification,
            imageUrl,
            areas,
            contact: { phone, email, room },
            page: { text: pageText, link: pageLink }
          })
        } catch (err) {
          console.error('Error parsing card:', err)
        }
      })

      return result
    })

    // post-process and add IDs
    const processedFaculties = faculties.map(f => ({
      id: generateId(f.name),
      name: f.name,
      designation: f.designation || 'Faculty',
      additionalRole: f.additionalRole,
      qualification: f.qualification,
      imageUrl: f.imageUrl,
      areas: f.areas,
      contact: {
        phone: f.contact.phone || null,
        email: parseEmail(f.contact.email),
        room: parseRoom(f.contact.room)
      },
      page: {
        text: f.page.text,
        link: fixPageLink(f.page.link)
      }
    }))

    console.log(`\n[5] Processed ${processedFaculties.length} faculty members`)

    // show sample
    console.log('\n[6] Sample faculty data:')
    const sample = processedFaculties.slice(0, 3)
    sample.forEach((f, i) => {
      console.log(`    ${i + 1}. ${f.name}`)
      console.log(`       Designation: ${f.designation}`)
      console.log(`       Room: ${f.contact.room || 'N/A'}`)
      console.log(`       Email: ${f.contact.email || 'N/A'}`)
    })

    // prepare output
    const validTopIds = TOP_FACULTY_IDS.filter(id =>
      processedFaculties.some(f => f.id === id)
    )

    // ensure data directory exists
    const { mkdirSync } = await import('fs')
    try {
      mkdirSync(join(__dirname, '..', 'data'), { recursive: true })
    } catch {}

    // generate TypeScript file
    const tsContent = `// Auto-generated by scripts/fetch-faculty.mjs
// Last updated: ${new Date().toISOString()}
// Total: ${processedFaculties.length} faculty members

import type { Faculty } from '@/types'

export const faculties: Faculty[] = ${JSON.stringify(processedFaculties, null, 2)}

export const topFacultyIds: string[] = ${JSON.stringify(validTopIds)}
`

    writeFileSync(OUTPUT_PATH, tsContent)
    console.log(`\n[7] Data saved to: ${OUTPUT_PATH}`)

    console.log('\n══════════════════════════════════════')
    console.log(`  TOTAL FACULTY FETCHED: ${processedFaculties.length}`)
    console.log('══════════════════════════════════════')

    return processedFaculties

  } catch (error) {
    console.error('\n[ERROR]', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

fetchFaculty().catch(err => {
  console.error(err)
  process.exit(1)
})
