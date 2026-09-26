const { Telegraf } = require("telegraf");
const http = require("http");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN is not set.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_FILE = "./data.json";

let users = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.log("Could not read data.json. Starting with empty data.");
    users = {};
  }
}

function saveUsers() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function getUser(ctx) {
  const id = String(ctx.from.id);

  if (!users[id]) {
    users[id] = {
      id: id,
      username: ctx.from.username || "",
      firstName: ctx.from.first_name || "Miner",
      balance: 0,
      referrals: 0,
      lastMining: 0,
      joinedAt: new Date().toISOString()
    };

    saveUsers();
  }

  return users[id];
}

function miningReward(user) {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (now - user.lastMining < oneHour) {
    const remaining = oneHour - (now - user.lastMining);
    const minutes = Math.ceil(remaining / 60000);

    return {
      success: false,
      minutes
    };
  }

  const reward = 10;

  user.balance += reward;
  user.lastMining = now;

  saveUsers();

  return {
    success: true,
    reward
  };
}

// START
bot.start(async (ctx) => {
  const user = getUser(ctx);

  const startPayload = ctx.startPayload;

  if (
    startPayload &&
    startPayload !== String(user.id) &&
    users[startPayload]
  ) {
    const inviter = users[startPayload];

    if (!user.referredBy) {
      user.referredBy = startPayload;
      inviter.referrals += 1;
      inviter.balance += 25;

      saveUsers();

      await ctx.reply(
        "🎉 Referral successful!\n\n" +
        "You joined through a referral.\n" +
        "The inviter received +25 NOVA points."
      );
    }
  }

  await ctx.reply(
    `🚀 Welcome to NovaMine, ${user.firstName}!\n\n` +
    `⛏️ Start mining NOVA points through Telegram.\n\n` +
    `💰 Balance: ${user.balance} NOVA\n` +
    `👥 Referrals: ${user.referrals}\n\n` +
    `Use /mine to start mining.\n` +
    `Use /balance to check your balance.`
  );
});

// MINE
bot.command("mine", async (ctx) => {
  const user = getUser(ctx);
  const result = miningReward(user);

  if (!result.success) {
    return ctx.reply(
      `⏳ Mining is still cooling down.\n\n` +
      `Try again in about ${result.minutes} minutes.`
    );
  }

  await ctx.reply(
    `⛏️ Mining started successfully!\n\n` +
    `🎁 You received +${result.reward} NOVA points.\n` +
    `💰 Balance: ${user.balance} NOVA\n\n` +
    `Come back after 1 hour to mine again.`
  );
});

// BALANCE
bot.command("balance", async (ctx) => {
  const user = getUser(ctx);

  await ctx.reply(
    `💰 Your NovaMine Balance\n\n` +
    `🪙 NOVA Points: ${user.balance}\n` +
    `👥 Referrals: ${user.referrals}`
  );
});

// REFERRAL
bot.command("referral", async (ctx) => {
  const user = getUser(ctx);

  const botUsername = ctx.botInfo.username;

  const referralLink =
    `https://t.me/${botUsername}?start=${user.id}`;

  await ctx.reply(
    `👥 NovaMine Referral\n\n` +
    `Invite friends and grow your NovaMine community.\n\n` +
    `🎁 Referral reward: 25 NOVA points\n\n` +
    `🔗 Your referral link:\n` +
    `${referralLink}`
  );
});

// HELP
bot.help(async (ctx) => {
  await ctx.reply(
    `🚀 NovaMine Commands\n\n` +
    `/start - Start NovaMine\n` +
    `/mine - Mine NOVA points\n` +
    `/balance - Check your balance\n` +
    `/referral - Get your referral link\n` +
    `/help - Show commands`
  );
});

// UNKNOWN COMMAND
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  if (text.startsWith("/")) {
    return;
  }

  await ctx.reply(
    `👋 Welcome to NovaMine!\n\n` +
    `Use /help to see available commands.`
  );
});

// ERROR HANDLER
bot.catch((error, ctx) => {
  console.error("Bot error:", error);

  try {
    ctx.reply("⚠️ Something went wrong. Please try again later.");
  } catch (e) {
    console.error(e);
  }
});

// HEALTH SERVER
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("NovaMine Telegram Bot is running 🚀");
});

server.listen(PORT, () => {
  console.log(`Health server running on port ${PORT}`);
});

// START BOT
bot.launch()
  .then(() => {
    console.log("NovaMine Telegram Bot started successfully 🚀");
  })
  .catch((error) => {
    console.error("Failed to start bot:", error);
    process.exit(1);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
