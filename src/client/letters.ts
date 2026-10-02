// The letters pages. Asks before a delete form submits.
for (const form of document.querySelectorAll("form.delete")) {
	form.addEventListener("submit", (e) => {
		if (!confirm("Delete this letter for good?")) e.preventDefault();
	});
}
