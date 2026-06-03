<script setup lang="ts">import { ref, onMounted, onUnmounted } from 'vue';
import { useFetch } from '#imports';
const stats = ref({
 total: 0,
 today: 0,
 online: 0,
});
let refreshInterval: ReturnType<typeof setInterval> | null = null;
const fetchStats = async () => {
 try {
 const response = await fetch('/api/visitors');
 const data = await response.json();
 stats.value = {
 total: data.total,
 today: data.today,
 online: data.online,
 };
 }
 catch (e) {
 console.error('Failed to fetch visitor stats:', e);
 }
};
const recordVisit = async () => {
 try {
 await fetch('/api/visitors', { method: 'POST' });
 await fetchStats();
 }
 catch (e) {
 console.error('Failed to record visit:', e);
 }
};
onMounted(() => {
 recordVisit();
 refreshInterval = setInterval(fetchStats, 10000);
});
onUnmounted(() => {
 if (refreshInterval) {
 clearInterval(refreshInterval);
 }
});
const formatNumber = (num: number): string => {
 if (num >= 10000) {
 return (num / 10000).toFixed(1) + 'w';
 }
 return num.toLocaleString();
};
</script>

<template>
<div class="visitor-stats">
	<div class="stats-container">
		<div class="stat-item">
			<div class="stat-icon">
				<Icon name="tabler:users" />
			</div>
			<div class="stat-content">
				<span class="stat-value">{{ formatNumber(stats.total) }}</span>
				<span class="stat-label">总访问量</span>
			</div>
		</div>

		<div class="stat-item">
			<div class="stat-icon">
				<Icon name="tabler:calendar" />
			</div>
			<div class="stat-content">
				<span class="stat-value">{{ formatNumber(stats.today) }}</span>
				<span class="stat-label">今日访问</span>
			</div>
		</div>

		<div class="stat-item">
			<div class="stat-icon online">
				<Icon name="tabler:circle-dot" />
			</div>
			<div class="stat-content">
				<span class="stat-value online">{{ stats.online }}</span>
				<span class="stat-label">当前在线</span>
			</div>
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.visitor-stats {
	.stats-container {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: center;
		padding: 1rem;
		background: var(--c-bg-soft);
		border-radius: 1rem;
		border: 1px solid var(--c-border);
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--c-bg);
		border-radius: 0.75rem;
		transition: transform 0.2s, box-shadow 0.2s;

		&:hover {
			transform: translateY(-2px);
			box-shadow: var(--box-shadow-2);
		}
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
		border-radius: 0.75rem;
		color: white;
		transition: transform 0.2s;

		svg {
			width: 1.25rem;
			height: 1.25rem;
		}

		&.online {
			background: linear-gradient(135deg, #10b981 0%, #059669 100%);
			animation: pulse-green 2s ease-in-out infinite;
		}
	}

	.stat-content {
		display: flex;
		flex-direction: column;

		.stat-value {
			font-size: 1.25rem;
			font-weight: 700;
			color: var(--c-text);
			transition: color 0.2s;

			&.online {
				color: #10b981;
			}
		}

		.stat-label {
			font-size: 0.75rem;
			color: var(--c-text-2);
		}
	}
}

@keyframes pulse-green {
	0%, 100% {
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
	}
	50% {
		box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
	}
}
</style>