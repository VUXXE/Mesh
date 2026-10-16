import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('Agent Journey: Navigate landing, join room, and explore toolbar', async ({
	agent,
	app,
	browser,
	screen
}) => {
	await app.open('/');

	// 1. Agent creates/joins a room from the landing page
	await agent.act('click Create Room to open a new whiteboard room');
	await expect(browser).toHaveURL(/\/room\//);

	// 2. Wait for canvas room to mount and verify toolbar is ready
	await expect(screen.getByRole('button', 'Grid settings')).toBeVisible();

	// 3. Agent inspects and selects the sticky note tool
	await agent.act('select the Sticky Note tool');
	await expect(screen.getByRole('button', 'Sticky Note')).toBeVisible();

	// 4. Agent opens the keyboard shortcuts modal
	await agent.act('open the keyboard shortcuts modal');
	await expect(screen.getByRole('dialog')).toBeVisible();

	// 5. Agent closes the dialog
	await agent.act('close the shortcuts modal');
	await expect(screen.getByRole('dialog')).not.toBeVisible();
});
