<script setup lang="ts">
interface FriendItem {
	name: string
	url: string
	avatar?: string
	desc?: string
}

const props = defineProps<{
	list?: FriendItem[]
}>()

const isExpanded = ref(false)
</script>

<template>
<div class="blog-friends">
	<button class="friends-header" @click="isExpanded = !isExpanded">
		<Icon name="tabler:users" />
		<span class="nav-text">好友</span>
		<Icon class="toggle-icon" :class="{ expand: isExpanded }" name="tabler:chevron-down" />
	</button>

	<Transition name="collapse">
		<div v-show="isExpanded" class="friends-content">
			<a
				v-for="friend in list"
				:key="friend.name"
				:href="friend.url"
				target="_blank"
				rel="noopener"
				class="friend-item"
			>
				<NuxtImg
					v-if="friend.avatar"
					:src="friend.avatar"
					:alt="friend.name"
					class="friend-avatar"
					loading="lazy"
				/>
				<Icon v-else name="tabler:user" class="friend-avatar-icon" />
				<div class="friend-info">
					<span class="friend-name">{{ friend.name }}</span>
					<span v-if="friend.desc" class="friend-desc">{{ friend.desc }}</span>
				</div>
			</a>
		</div>
	</Transition>
</div>
</template>

<style lang="scss" scoped>
.blog-friends {
	display: flex;
	flex-direction: column;
}

.friends-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding: 0.5em 1em;
	border-radius: 0.5em;
	font: inherit;
	color: inherit;
	cursor: pointer;
	transition: all 0.2s;

	&:hover {
		background-color: var(--c-bg-soft);
		color: var(--c-text);
	}

	> .iconify {
		font-size: 1.5em;
	}

	> .nav-text {
		flex-grow: 1;
		text-align: start;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

.toggle-icon {
	font-size: 1em;
	transition: transform 0.2s;

	&.expand {
		transform: rotate(180deg);
	}
}

.friends-content {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	padding-inline-start: 1em;
	overflow: hidden;
}

.friend-item {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding: 0.4em 0.8em;
	border-radius: 0.5em;
	text-decoration: none;
	color: var(--c-text-2);
	transition: all 0.2s;

	&:hover {
		background-color: var(--c-bg-soft);
		color: var(--c-text);
	}
}

.friend-avatar {
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;
}

.friend-avatar-icon {
	font-size: 1.5em;
	flex-shrink: 0;
}

.friend-info {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	line-height: 1.3;
}

.friend-name {
	font-size: 0.9em;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.friend-desc {
	font-size: 0.75em;
	opacity: 0.5;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

// 折叠动画
.collapse-enter-active,
.collapse-leave-active {
	transition: all 0.25s ease;
}

.collapse-enter-from,
.collapse-leave-to {
	opacity: 0;
	max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
	opacity: 1;
	max-height: 500px;
}
</style>
