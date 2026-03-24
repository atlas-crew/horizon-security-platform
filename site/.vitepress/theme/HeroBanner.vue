<template>
  <div class="hero-banner">
    <img src="/images/brand/edge-protection-banner.svg" alt="Horizon and Synapse" class="hero-banner-img" />
    <div class="hero-banner-actions">
      <a href="/getting-started/" class="hero-btn hero-btn-brand">Get Started</a>
      <a href="https://github.com/atlas-crew/edge-protection" target="_blank" class="hero-btn hero-btn-alt">View on GitHub</a>
    </div>
  </div>
</template>

<style scoped>
.hero-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px 48px;
  width: 100%;
}

.hero-banner-img {
  width: 100%;
  max-width: 1280px;
  height: auto;
  display: block;
}

.hero-banner-actions {
  display: flex;
  gap: 12px;
  margin-top: 40px;
}

.hero-btn {
  display: inline-block;
  padding: 10px 24px;
  font-family: 'Recursive', ui-monospace, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
}

.hero-btn-brand {
  background: #1E90FF;
  color: #fff;
}

.hero-btn-brand:hover {
  background: #0A6ED8;
}

.hero-btn-alt {
  background: transparent;
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-border);
}

.hero-btn-alt:hover {
  border-color: var(--vp-c-text-2);
}
</style>
