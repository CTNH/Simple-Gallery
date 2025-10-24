export const TAG_STATUS = {
	INACTIVE: 0,
	ACTIVE: 1,
	INVERSE: 2
};

export function createTagButton(
	tag,
	callbacks = {
		inactive: () => {},
		active: () => {},
		inverse: () => {}
	},
	stat = TAG_STATUS.INACTIVE,
) {
	let elem = document.createElement('a');
	elem.textContent = tag;

	switch(stat) {
		case TAG_STATUS.INACTIVE:
			elem.className = 'inactive';
			break;
		case TAG_STATUS.ACTIVE:
			elem.className = 'active';
			break;
		case TAG_STATUS.INVERSE:
			elem.className = 'inverse';
			break;
	}

	elem.addEventListener('click', () => {
		// Cycle status
		stat = (stat + 1) % 2;

		switch (stat) {
			case TAG_STATUS.INACTIVE:
				elem.className = 'inactive';
				callbacks.inactive(tag);
				break;
			case TAG_STATUS.ACTIVE:
				elem.className = 'active';
				callbacks.active(tag);
				break;
			case TAG_STATUS.INVERSE:
				elem.className = 'inverse';
				callbacks.inverse(tag);
				break;
		}
	});

	return elem;
}

