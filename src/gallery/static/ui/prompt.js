let inputError = document.getElementById('input-error');

export function showInputErr(msg) {
	inputError.classList.add('active');
	inputError.innerHTML = msg;
}

export function hideInputErr() {
	inputError.classList.remove('active');
	inputError.innerText = '';
}

export function openInputPrompt({ header, placeholder, value='' }) {
	document.getElementById('input-info-header').innerText = header;
	const input = document.getElementById('input-input');
	input.placeholder = placeholder;
	input.value = value;
	document.getElementById('input-overlay').classList.add('active');
	input.select();
}

export function closeInputPrompt() {
	hideInputErr();
	document.getElementById('input-overlay').classList.remove('active');
}

