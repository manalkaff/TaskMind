<script>
	import '../app.css';
	import * as Card from "$lib/components/ui/card/index.js";
	import { X } from "lucide-svelte";
	import { onMount } from 'svelte';

	let show_guide = false

	function closeGuide() {
        show_guide = false;
        localStorage.setItem('guideClosed', 'true');
    }

	onMount(() => {
		show_guide = !localStorage.getItem('guideClosed');
	})

</script>

<div class="app">
	{#if show_guide}
		<Card.Root class=" z-30  absolute bottom-0 right-0 m-10 w-1/2 h-1/2">
			<Card.Header>
			<Card.Title>
				🛠️ How to Use TaskMind
				<button class="float-right" on:click={closeGuide}>
					<X />
				</button>
			</Card.Title>
			<Card.Description>First time guide</Card.Description>
			</Card.Header>
			<Card.Content>

				Here’s a quick guide to help you get started with TaskMind:
				<ul>
					<li>- ✏️ Toggle Drawing Mode: Click the button in the top left corner to enter drawing mode and create new tasks.</li>
					<li>- ✅ Update Task Status: Click on a task shape to toggle its status.</li>
					<li>- ✍️ Edit Task Text: Double-click on a task shape to edit its text.</li>
					<li>- 🗑️ Delete a Task: Press Delete or Backspace to remove the selected task.</li>
				</ul>
				
			</Card.Content>
			<Card.Footer>
			<p>TaskMind is all about simplicity and interactivity! 🎨👩‍💻</p>
			</Card.Footer>
		</Card.Root>
	  {/if}
	<main>
		<slot />
	</main>
</div>

