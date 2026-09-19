<script setup lang="ts">
import '~/assets/css/homepage.css'
useSeoMeta({
  title: 'Invoxa · Less paperwork. More headspace.',
  description: 'Keep supplier invoices together, review every detail, and see what is paid or still due. A clearer invoice workflow for small businesses.',
})
const config = useRuntimeConfig().public
// The protected route checks saved sessions, including after a homepage reload.
const workspaceLink = '/dashboard'
const menuOpen = ref(false)
const activeStep = ref(0)
const samplePaid = ref(false)
const sampleConfirmed = ref(false)
const demoMessage = ref('')
const steps = [
  { name: 'Bring your bills together.', label: 'Upload', detail: 'A PDF from your inbox. A photo from your phone. Give every supplier bill a place to land.', icon: 'upload' as const },
  { name: 'A second look. A better record.', label: 'Review', detail: 'Check the original, fill in the details, and confirm. Your totals only include the bills you have reviewed.', icon: 'document' as const },
  { name: 'Know what needs you next.', label: 'Keep track', detail: 'See what is paid, what is still due, and what needs attention. Find that one invoice without the folder hunt.', icon: 'grid' as const },
]
const comparison = [
  ['Bills scattered across inboxes', 'One organized invoice workspace'],
  ['Payment status in a separate spreadsheet', 'Paid and unpaid, right beside the bill'],
  ['Due dates buried inside PDFs', 'A clear view of what is due next'],
  ['Opening files to find one detail', 'Search, filter, and get back to work'],
]
const faqs = computed(() => [
  { question: 'Who is Invoxa for?', answer: 'Small businesses that want a simpler way to organize supplier invoices and track what they owe. This first version supports INR bills and one owner per workspace.' },
  { question: 'What can I upload?', answer: 'PDF, JPEG, and PNG files up to 8 MB, with up to 10 pages per PDF. Use one invoice per file. You can review the original alongside its details before confirming.' },
  { question: 'Does it read invoices automatically?', answer: config.appMode === 'local' ? 'The current local version uses manual entry and review. Integration code for Amazon Textract is prepared, but automated extraction needs AWS deployment and live testing.' : 'The AWS integration is designed to suggest invoice details using Amazon Textract. You still review and confirm each invoice before it enters your totals. Extraction depends on the configured backend.' },
  { question: 'Can I try it now?', answer: config.appMode === 'local' ? 'Yes. Open the workspace and create a local test account. Records stay on this computer. This is a portfolio project demo; use sample invoices while exploring.' : 'Use Open workspace to continue to secure sign-in. This is a portfolio project; use sample invoices while exploring the workflow.' },
])
function selectStep(index: number) { activeStep.value = index; demoMessage.value = '' }
function confirmSample() {
  sampleConfirmed.value = true
  activeStep.value = 2
  demoMessage.value = samplePaid.value ? 'Sample invoice confirmed. It is already marked paid.' : 'Sample invoice confirmed. ₹49,560 is outstanding.'
}
function togglePayment() {
  samplePaid.value = !samplePaid.value
  demoMessage.value = samplePaid.value ? 'Sample marked paid. Outstanding balance is now ₹0.' : 'Sample marked unpaid. Outstanding balance is now ₹49,560.'
}
function resetDemo() {
  samplePaid.value = false
  sampleConfirmed.value = false
  activeStep.value = 0
  demoMessage.value = 'Sample preview reset.'
}
</script>

<template>
  <div class="invoxa-home">
    <a class="skip-link" href="#home-content">Skip to content</a>
    <div class="home-dark">
      <header class="home-nav home-container">
        <NuxtLink to="/" class="home-brand" aria-label="Invoxa home"><InvoxaLogo /></NuxtLink>
        <nav class="home-desktop-nav" aria-label="Homepage navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#the-difference">Why Invoxa</a>
          <a href="#questions">Questions</a>
        </nav>
        <div class="home-nav-actions">
          <NuxtLink to="/login" class="home-sign-in">Sign in</NuxtLink>
          <NuxtLink :to="workspaceLink" class="home-button home-button-lime home-nav-cta">Open workspace <HomeIcon name="arrow" /></NuxtLink>
          <button class="home-menu-toggle" :aria-expanded="menuOpen" aria-controls="home-mobile-menu" :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'" @click="menuOpen = !menuOpen"><HomeIcon :name="menuOpen ? 'close' : 'menu'" /></button>
        </div>
      </header>
      <nav v-if="menuOpen" id="home-mobile-menu" class="home-mobile-nav" aria-label="Mobile homepage navigation">
        <a href="#how-it-works" @click="menuOpen = false">How it works <HomeIcon name="arrow" /></a>
        <a href="#the-difference" @click="menuOpen = false">Why Invoxa <HomeIcon name="arrow" /></a>
        <a href="#questions" @click="menuOpen = false">Questions <HomeIcon name="arrow" /></a>
      </nav>

      <main id="home-content" class="home-main">
        <section class="home-hero home-container" aria-labelledby="hero-heading">
          <div class="home-hero-copy">
            <p class="home-eyebrow"><span class="home-live-dot"></span> SMALL BUSINESS. CLEARER BOOKKEEPING.</p>
            <h1 id="hero-heading">Less paperwork.<br>More <span class="home-serif">headspace.</span></h1>
            <p class="home-hero-description">Bills have a way of piling up.<br>Bring them together, check the details, and know exactly what needs paying.</p>
            <div class="home-hero-actions">
              <NuxtLink :to="workspaceLink" class="home-button home-button-lime">Find your clarity <HomeIcon name="arrow" /></NuxtLink>
              <a href="#how-it-works" class="home-text-button"><span class="home-play-icon" aria-hidden="true">▷</span> Take a little tour</a>
            </div>
            <p class="home-hero-note"><HomeIcon name="check" /> Built around supplier bills. Designed around you.</p>
          </div>

          <div class="home-invoice-scene" role="img" aria-label="Illustration of a reviewed ABC Traders invoice for 49,560 rupees, organized in an Invoxa workspace. Sample data.">
            <div class="home-scene-orbit" aria-hidden="true"></div>
            <span class="home-scene-spark" aria-hidden="true">✳</span>
            <div class="home-file-label"><HomeIcon name="document" /><span>one less thing<br><strong>on your mind.</strong></span></div>
            <div class="home-paper-back" aria-hidden="true"></div>
            <div class="home-hero-paper">
              <div class="home-paper-top"><span class="home-supplier-logo">a.</span><span>SUPPLIER INVOICE<br><b>#INV-2041</b></span></div>
              <div class="home-paper-title"><span>ABC Traders</span><small>Office supplies & essentials</small></div>
              <div class="home-paper-date"><span>INVOICE DATE<strong>02 Sep 2026</strong></span><span>PAYMENT DUE<strong>02 Oct 2026</strong></span></div>
              <div class="home-paper-lines"><div><span>Office supplies</span><b>₹42,000.00</b></div><div><span>GST · 18%</span><b>₹7,560.00</b></div></div>
              <div class="home-paper-sum"><span>Total amount</span><strong>₹49,560<span>.00</span></strong></div>
              <div class="home-paper-approved"><HomeIcon name="check" /> Details checked. Ready to track.</div>
              <div class="home-paper-bottom"><span class="home-barcode" aria-hidden="true"></span><span>A PLACE FOR EVERY BILL.</span></div>
            </div>
            <div class="home-status-float"><span class="home-status-symbol"><HomeIcon name="check" /></span><div><strong>All in order.</strong><span>Reviewed & confirmed</span></div><span class="home-status-number">01</span></div>
            <div class="home-outstanding-float"><div><span>Outstanding</span><HomeIcon name="arrow" /></div><strong>₹49,560</strong><p><span></span> You know what’s next.</p></div>
            <p class="home-scene-caption">A little structure. A lighter day. <span aria-hidden="true">⤴</span></p>
          </div>
        </section>
        <div class="home-promise-strip home-container" aria-label="Core workflow">
          <span>A good day starts<br>with things in order.</span>
          <div><span class="home-strip-number">01</span> A place for every bill <HomeIcon name="document" /></div>
          <div><span class="home-strip-number">02</span> A moment to review <HomeIcon name="check" /></div>
          <div><span class="home-strip-number">03</span> A clearer next step <HomeIcon name="arrow" /></div>
        </div>

        <section id="how-it-works" class="home-workflow" aria-labelledby="workflow-heading">
          <div class="home-container">
            <div class="home-section-heading"><div><p class="home-eyebrow">THE EVERYDAY, MADE EASIER</p><h2 id="workflow-heading">From inbox clutter<br>to <span class="home-serif">all sorted.</span></h2></div><p>You don’t need another complicated system.<br>Just a simple rhythm for your bills.</p></div>
            <div class="home-workflow-grid">
              <div class="home-steps" aria-label="Explore the invoice workflow">
                <button v-for="(step, index) in steps" :key="step.label" class="home-step" :class="{ 'is-active': activeStep === index }" :aria-pressed="activeStep === index" aria-controls="workflow-preview" @click="selectStep(index)">
                  <span class="home-step-number">0{{ index + 1 }}</span><span class="home-step-copy"><strong>{{ step.name }}</strong><span>{{ step.detail }}</span></span><HomeIcon name="arrow" />
                </button>
                <p class="home-step-footnote"><span></span> Click a step. See the flow for yourself.</p>
              </div>
              <div id="workflow-preview" class="home-demo">
                <div class="home-demo-toolbar"><span class="home-mini-brand">i</span><strong>Your everyday workspace</strong><span class="home-sample-label">SAMPLE PREVIEW</span></div>
                <div class="home-demo-content">
                  <div class="home-demo-title"><div><p>0{{ activeStep + 1 }} / {{ steps[activeStep]!.label }}</p><h3>{{ activeStep === 0 ? 'Start with one bill.' : activeStep === 1 ? 'You have the final say.' : 'A little more clarity.' }}</h3></div><span class="home-demo-title-icon"><HomeIcon :name="steps[activeStep]!.icon" /></span></div>
                  <div v-if="activeStep === 0" class="home-upload-preview">
                    <div class="home-upload-illustration"><HomeIcon name="upload" /></div><strong>A new home for your invoices.</strong><p>PDF, JPEG or PNG · up to 8 MB</p>
                    <div class="home-sample-file"><span><HomeIcon name="document" /></span><div><strong>abc-traders-invoice.pdf</strong><small>Sample supplier invoice · 1 page</small></div><HomeIcon name="check" /></div>
                    <button class="home-button home-button-dark" @click="selectStep(1)">Review sample invoice <HomeIcon name="arrow" /></button>
                  </div>
                  <div v-else-if="activeStep === 1" class="home-review-preview">
                    <div class="home-review-note"><HomeIcon name="document" /><span>Compare the details. Confirm when they look right.</span></div>
                    <dl class="home-review-fields"><div><dt>Supplier</dt><dd>ABC Traders</dd></div><div><dt>Invoice number</dt><dd>INV-2041</dd></div><div><dt>Subtotal</dt><dd>₹42,000.00</dd></div><div><dt>GST</dt><dd>₹7,560.00</dd></div></dl>
                    <div class="home-review-total"><span>Total amount</span><strong>₹49,560.00</strong></div>
                    <button class="home-button home-button-dark" @click="confirmSample">Confirm sample invoice <HomeIcon name="check" /></button>
                  </div>
                  <div v-else class="home-track-preview">
                    <div class="home-demo-summary"><span>Total outstanding</span><strong>{{ sampleConfirmed && !samplePaid ? '₹49,560' : '₹0' }}<small>.00</small></strong><span>{{ !sampleConfirmed ? 'Confirm the sample to include it here.' : samplePaid ? 'All caught up. That feels good.' : 'One reviewed invoice to keep an eye on.' }}</span></div>
                    <div class="home-demo-invoice"><span class="home-demo-vendor">A</span><div><strong>ABC Traders</strong><small>INV-2041 · ₹49,560.00</small></div><span class="home-demo-badge" :class="{ 'is-paid': sampleConfirmed && samplePaid }">{{ !sampleConfirmed ? 'Needs review' : samplePaid ? 'Paid' : 'Unpaid' }}</span></div>
                    <button v-if="sampleConfirmed" class="home-button home-button-dark" @click="togglePayment">{{ samplePaid ? 'Mark as unpaid' : 'Mark as paid' }} <HomeIcon :name="samplePaid ? 'reset' : 'check'" /></button>
                    <button v-else class="home-button home-button-dark" @click="selectStep(1)">Review the sample first <HomeIcon name="arrow" /></button>
                  </div>
                </div>
                <div class="home-demo-footer"><span>Interactive preview · no data is saved</span><button aria-label="Reset sample preview" @click="resetDemo"><HomeIcon name="reset" /> Reset</button></div>
                <p class="home-sr-only" role="status">{{ demoMessage }}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="the-difference" class="home-difference" aria-labelledby="difference-heading">
          <div class="home-container">
            <div class="home-section-heading"><div><p class="home-eyebrow">LESS FRICTION. MORE FOCUS.</p><h2 id="difference-heading">Your business has enough<br><span class="home-serif">moving parts.</span></h2></div><p>Let your invoices be the organized bit.</p></div>
            <div class="home-comparison">
              <div class="home-comparison-before"><h3><span aria-hidden="true">↗</span> The usual way</h3><p>Sound familiar?</p><ul><li v-for="row in comparison" :key="row[0]"><HomeIcon name="close" />{{ row[0] }}</li></ul></div>
              <div class="home-comparison-after"><h3><span class="home-mini-brand">i</span> The Invoxa way</h3><p>A little more in control.</p><ul><li v-for="row in comparison" :key="row[1]"><HomeIcon name="check" />{{ row[1] }}</li></ul><span class="home-comparison-stamp" aria-hidden="true">less mess.<br><i>more yes.</i></span></div>
            </div>
            <div class="home-feature-notes"><article><HomeIcon name="search" /><h3>Find it. And move on.</h3><p>Search suppliers, filter by status, and find the bill you need.</p></article><article><HomeIcon name="clock" /><h3>See what’s coming.</h3><p>Keep unpaid, overdue, and due-soon invoices in view.</p></article><article><HomeIcon name="document" /><h3>Your records, to go.</h3><p>Export a CSV when it is time to share or work elsewhere.</p></article></div>
          </div>
        </section>

        <section id="questions" class="home-faq" aria-labelledby="faq-heading"><div class="home-container home-faq-grid"><div><p class="home-eyebrow">A FEW THINGS TO KNOW</p><h2 id="faq-heading">Good questions.<br><span class="home-serif">Clear answers.</span></h2></div><div class="home-faq-list"><details v-for="faq in faqs" :key="faq.question"><summary>{{ faq.question }}<HomeIcon name="plus" /></summary><p>{{ faq.answer }}</p></details></div></div></section>

        <section class="home-final-cta" aria-labelledby="cta-heading"><div class="home-container home-cta-inner"><div><p class="home-eyebrow">MAKE A LITTLE ROOM FOR WHAT’S NEXT</p><h2 id="cta-heading">Close the tabs.<br>Find your <span class="home-serif">headspace.</span></h2></div><div><NuxtLink :to="workspaceLink" class="home-button home-button-dark">Open your workspace <HomeIcon name="arrow" /></NuxtLink><p>One bill is a good place to start.</p></div><span class="home-cta-flower" aria-hidden="true">✳</span></div></section>
      </main>
      <footer class="home-footer home-container"><div><NuxtLink to="/" class="home-brand" aria-label="Invoxa home"><InvoxaLogo compact /></NuxtLink><p>Supplier bills, kept in order.</p></div><div class="home-footer-note"><span class="home-live-dot"></span>{{ config.appMode === 'local' ? 'Local project demo' : 'Invoxa project' }}<p>Made for a little more clarity.</p></div><a href="https://github.com/rizwyy/invoxa" target="_blank" rel="noopener noreferrer">Explore the project <HomeIcon name="arrow" /></a></footer>
    </div>
  </div>
</template>
