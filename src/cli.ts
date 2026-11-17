import 'dotenv/config';
import readline from 'readline';
import { AgentOrchestrator } from './core/agent/orchestrator';
import { brainVault } from './core/memory/brain-vault';

async function runCLI() {
  await brainVault.init();

  console.log(`
================================================================
✨ Chat Agent Terminal Interface
🧠 Memory System Active
🔍 Web Search Tool Active
Type your question or 'exit' to quit.
================================================================
  `);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('\n💬 You: ', async (input) => {
      const text = input.trim();
      if (!text || text.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
      }

      console.log('\n🤖 Chat Agent:');

      await AgentOrchestrator.execute(text, {
        autoPilot: true,
        onScratchpad: (event) => {
          if (event.type === 'memory_recall') {
            console.log(`\x1b[35m🧠 [Memory System] ${event.content}\x1b[0m`);
          } else if (event.type === 'tool_end') {
            console.log(`\x1b[36m🔍 [Search] ${event.content}\x1b[0m\n`);
          }
        },
        onApprovalRequired: () => {},
        onToolApproved: () => {},
        onToken: (token) => {
          process.stdout.write(token);
        },
        onCitations: (citations) => {
          if (citations.length > 0) {
            console.log('\n\n\x1b[32mSources:\x1b[0m');
            citations.forEach((c) => {
              console.log(`[${c.index}] ${c.title} (${c.domain}) - ${c.url}`);
            });
          }
        },
        onError: (err) => {
          console.error('\n\x1b[31mError:\x1b[0m', err.message);
          promptUser();
        },
        onDone: () => {
          console.log('\n');
          promptUser();
        },
      });
    });
  };

  promptUser();
}

runCLI();
