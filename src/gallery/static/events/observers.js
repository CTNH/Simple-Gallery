// Intersection Observer setup for lazy loading
export let observer;

export function setupObserver() {
	if (observer) {
		observer.disconnect();
	}
	observer = new IntersectionObserver(
		(entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const item = entry.target;
					if (!item.src) {
						item.src = item.dataset.src;
						observer.unobserve(item);
					}
				}
			});
		},
		{ rootMargin: '200px' }
	);
}

