// database.js
const { MongoClient, ObjectId } = require("mongodb");

// MongoDB connection string
const url = process.env.MONGOLINK;

// MongoDB database name
const dbName = process.env.myproject;

// Create a new MongoClient
const client = new MongoClient(url, { useUnifiedTopology: true });

// Function to generate a random alphanumeric string
function generateId() {
  return Math.random().toString(36).substr(2, 5).toUpperCase();
}

async function addCards(card, quantity) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const tempCardsCollection = db.collection("tempcards");
    const activeCardsCollection = db.collection("activecards");
    let cardsToInsert = [];
    for (let i = 0; i < quantity; i++) {
      let uniqueCardId;
      do {
        uniqueCardId = generateId();
      } while (
        (await tempCardsCollection.findOne({ card_id: uniqueCardId })) ||
        (await activeCardsCollection.findOne({ card_id: uniqueCardId }))
      );

      // Create a new card object for each card to be inserted
      let newCard = {
        ...card,
        card_id: uniqueCardId,
        quantity: quantity,
      };

      cardsToInsert.push(newCard);
    }
    //
    return cardsToInsert;
  } catch (err) {
    console.error("Error adding cards to database:", err);
    throw err; // Throw the error so that the calling function is aware of it
  }
}
// Function to add a new player to the database
async function addPlayer(player) {
  try {
    // Connect to the MongoDB server
    await client.connect();

    // Get the database
    const db = client.db(dbName);

    // Get the 'players' collection
    const players = db.collection("players");

    // Check if the player already exists
    const existingPlayer = await players.findOne({ user_id: player.user_id });
    if (existingPlayer) {
      // The player already exists, return null
      return null;
    }

    // Insert the player into the 'players' collection
    const result = await players.insertOne(player);

    // Create a new collection named after the player's user_id
    // await db.createCollection(player.user_id);

    // Return the result
    return result;
  } catch (err) {
    console.error("Error adding player to database:", err);
  }
}

// Function to add a new frame to the database
async function addFrame(frame) {
  try {
    // Connect to the MongoDB server
    await client.connect();

    // Get the database
    const db = client.db(dbName);

    // Get the 'frames' collection
    const frames = db.collection("frames");

    // Check if the frame already exists
    const existingFrame = await frames.findOne({ frameid: frame.frameid });
    if (existingFrame) {
      // The frame already exists, return null
      return null;
    }

    // Insert the frame into the 'frames' collection
    const result = await frames.insertOne(frame);

    // Return the result
    return result;
  } catch (err) {
    console.error("Error adding frame to database:", err);
  }
}

async function getCards() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("activecards");

    // Define the rarity weights
    const rarityWeights = {
      Common: 100, // Common
      Uncommon: 70, // Uncommon
      Rare: 20, // Rare
      Exotic: 5, // Exotic
      Ultra: 1, // Ultra
    };

    // Create a weighted array
    let weightedArray = [];
    for (let [rarity, weight] of Object.entries(rarityWeights)) {
      let randomCards = await collection
        .aggregate([
          { $match: { rarity: rarity, been_dealt: false } },
          { $sample: { size: parseInt(weight) } },
        ])
        .toArray();
      weightedArray = weightedArray.concat(randomCards);
    }

    // Select three cards
    let selectedCards = [];
    for (let i = 0; i < 3; i++) {
      let randomIndex = Math.floor(Math.random() * weightedArray.length);
      let selectedCard = weightedArray.splice(randomIndex, 1); // Remove the selected card from the weighted array
      if (selectedCard.length > 0) {
        selectedCards.push(selectedCard[0]);
      }
    }

    return selectedCards;
  } catch (err) {
    console.error("Error getting cards from database:", err);
  }
  return [];
}

async function markDealt(cards) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    for (let card of cards) {
      await cardCollection.updateOne(
        { card_id: card.card_id },
        { $set: { been_dealt: true } },
      );
    }
  } catch (err) {
    console.error("Error getting cards from database:", err);
  }
}

async function addCardToUserCollection(userId, cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    // Find the card in the 'cards' collection
    const card = await cardCollection.updateOne(
      { card_id: cardId, user_id: "" },
      { $set: { user_id: userId } },
    );
    //delete dropData[cardId];

    if (card["matchedCount"] > 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error("Error cloning card to user collection:", err);
  }
}

async function checkIfPlayer(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");

    // Find the player in the 'players' collection
    const player = await playerCollection.findOne({ user_id: userId });

    if (player) {
      // Player is registered
      return true;
    } else {
      // Player is not registered
      console.log("Player must register as a new player first.");
      return false;
    }
  } catch (err) {
    console.error("Error checking if player is registered:", err);
  }
}
async function updatePlayer(userId, fieldsToUpdate) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $set: fieldsToUpdate },
    );
    return result;
  } catch (err) {
    console.error("Error updating player:", err);
    throw err;
  }
}

async function updateExtraGrabs(userId, extraGrabs) {
  try {
    if (extraGrabs === 0) {
      return true;
    }
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { extra_grabs: extraGrabs } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating extra grabs:", err);
    throw err;
  }
}

async function updateExtraDrops(userId, extraDrops) {
  try {
    if (extraDrops === 0) {
      return true;
    }
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");

    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { extra_drops: parseInt(extraDrops) } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating extra drops:", err);
    throw err;
  }
}
async function updatePlayerCurrency(userId, currency) {
  // Connect to the database and update the card's currency
  try {
    if (currency === 0) {
      return true;
    }

    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { currency: currency } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating currency:", err);
    throw err;
  }
}

async function updatePlayerDust(userId, dust) {
  // Connect to the database and update the card's dust
  try {
    if (dust === 0) {
      return true;
    }
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { dust: dust } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating currency:", err);
    throw err;
  }
}

async function updatePlayerParts(userId, parts) {
  // Connect to the database and update the card's parts
  try {
    if (parts === 0) {
      return true;
    }
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { parts: parts } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating currency:", err);
    throw err;
  }
}

async function updatePlayerFragments(userId, fragments) {
  // Connect to the database and update the card's fragments
  try {
    if (fragments === 0) {
      return true;
    }
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $inc: { fragments: fragments } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating currency:", err);
    throw err;
  }
}
async function updatePlayerDropCooldown(userId, cooldown) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $set: { dropCooldown: cooldown } },
    );
    return result.acknowledged;
  } catch (err) {
    console.error("Error updating player cooldown:", err);
    return null;
  }
}
async function getPlayerDropCooldown(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const player = await players.findOne({ user_id: userId });
    //await client.close();
    return player ? player.dropCooldown : null;
  } catch (err) {
    console.error("Error getting player cooldown:", err);
    return null;
  }
}

async function updateGrabCooldown(userId, cooldown) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const result = await players.updateOne(
      { user_id: userId },
      { $set: { grabCooldown: cooldown } },
    );
    //await client.close();
    return result;
  } catch (err) {
    console.error("Error updating player cooldown:", err);
    return null;
  }
}

async function getGrabCooldown(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const players = db.collection("players");
    const player = await players.findOne({ user_id: userId });
    //await client.close();
    return player ? player.grabCooldown : null;
  } catch (err) {
    console.error("Error getting player cooldown:", err);
    return null;
  }
}

async function resetDealtCards() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    const result = await cardCollection.updateMany(
      { been_dealt: true, user_id: "" },
      { $set: { been_dealt: false } },
    );

    
  } catch (err) {
    console.error("Error resetting cards to been_dealt false:", err);
  }
}

async function createSubmission(userId, imageUrl, nameOfCard, source) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const submissionCollection = db.collection("submissions");

    const newSubmission = {
      user_id: userId,
      Image_url: imageUrl,
      name_of_card: nameOfCard,

      Source: source,
    };

    const result = await submissionCollection.insertOne(newSubmission);

    
    return result.insertedId;
  } catch (err) {
    console.error("Error creating submission:", err);
    throw err;
  }
}
async function getPlayer(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");

    const player = await playerCollection.findOne({ user_id: userId });

    return player;
  } catch (err) {
    console.error("Error fetching player:", err);
    throw err;
  }
}

async function getCard(cardName) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    const card = await cardCollection.findOne({ card_name: cardName });

    return card;
  } catch (err) {
    console.error("Error fetching card:", err);
    throw err;
  }
}

async function getCardsByUserId(userId, limit, page, tag, sort, order) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    // Add a condition to the query to filter by the tag field
    const query = { user_id: userId, been_burnt: false };
    if (tag) {
      query.tag = tag;
    }

    // Create a sort object based on the sort and order parameters
    const sortObject = {};
    if (sort) {
      sortObject[sort] = order === "desc" ? -1 : 1;
    }

    const cards = await cardCollection
      .find(query)
      .sort(sortObject)
      .limit(limit)
      .skip(limit * page)
      .toArray();
    return cards; // returns the entire card objects now
  } catch (err) {
    console.error("Error fetching cards:", err);
    throw err;
  }
}

async function getLastCollectedCard(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);

    // Get the player's data
    const playerCollection = db.collection("players");
    const player = await playerCollection.findOne({ user_id: userId });

    // If the player doesn't exist or hasn't collected any cards yet, return null
    if (!player || !player.last_card) {
      return null;
    }

    // Get the card data
    const cardCollection = db.collection("activecards");
    const card = await cardCollection.findOne({ card_id: player.last_card });

    return card;
  } catch (err) {
    console.error("Error fetching last collected card:", err);
    throw err;
  }
}
async function updateLastCollectedCard(userId, cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    // Get the player's data
    const playerCollection = db.collection("players");
    const player = await playerCollection.findOne({ user_id: userId });
    // If the player doesn't exist, return error
    if (!player) {
      throw new Error("Player not found");
    }
    // Update the player's last_card field
    const lastCard = await playerCollection.updateOne(
      { user_id: userId },
      { $set: { last_card: cardId } },
    );
    return lastCard;
  } catch (err) {
    console.error("Error updating last collected card:", err);
    throw err;
  }
}

async function getCardSuggestions(startsWith) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");

    // Use a regular expression to find cards that start with the given string
    const cards = await cardCollection
      .find({ card_name: new RegExp("^" + startsWith) })
      .toArray();

    return cards;
  } catch (err) {
    console.error("Error fetching card suggestions:", err);
    throw err;
  }
}

async function updateCardTag(userId, cardId, tag) {
  try {
    await client.connect();
    const db = client.db(dbName);
    // Get the card's data
    const cardCollection = db.collection("activecards");
    const card = await cardCollection.findOne({
      card_id: cardId,
      user_id: userId,
    });
    // If the card doesn't exist or doesn't belong to the user, return error
    if (!card) {
      throw new Error("Card not found or doesn't belong to the user");
    }
    // Update the card's tag field
    const updatedCard = await cardCollection.updateOne(
      { card_id: cardId, user_id: userId, been_burnt: false },
      { $set: { tag: tag } },
    );
    return updatedCard;
  } catch (err) {
    console.error("Error updating card tag, card may have been burned:", err);
    throw err;
  }
}

async function getLastCard(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");
    const player = await playerCollection.findOne({
      user_id: userId,
      been_burnt: false,
    });

    // Return the last_card field from the player document
    return player ? player.last_card : null;
  } catch (err) {
    console.error("Error fetching last card for user:", err);
    throw err;
  }
}

async function addTagToArray(userId, tag) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");

    const updateDocument = {
      $push: { tags: tag },
    };

    await playerCollection.updateOne({ user_id: userId }, updateDocument);
  } catch (err) {
    console.error("Error adding tag to array:", err);
    throw err;
  }
}

async function removeTagFromArray(userId, tag) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");

    const updateDocument = {
      $pull: { tags: tag },
    };

    await playerCollection.updateOne({ user_id: userId }, updateDocument);
  } catch (err) {
    console.error("Error removing tag from array:", err);
    throw err;
  }
}

async function ownedCardSuggestions(userId, startsWith, excludeTag = null) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    // Use a regular expression to find cards that start with the given string
    // and belong to the user
    let query = {
      user_id: userId,
      been_burnt: false,
      card_name: new RegExp("^" + startsWith),
    };
    // Conditionally modify the query if excludeTag is provided
    if (excludeTag) {
      query.tag = { $ne: excludeTag };
    }
    const cards = await cardCollection
      .find(query)
      .toArray();
    return cards;
  } catch (err) {
    console.error("Error fetching owned card suggestions:", err);
    throw err;
  }
}

async function getCardById(cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const card = await cardCollection.findOne({
      card_id: cardId,
      been_burnt: false,
    });
    return card;
  } catch (err) {
    console.error("Error fetching card by ID:", err);
    throw err;
  }
}

async function initializeDropData(cardId, userId) {
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("dropData"); // Replace with your database and collection names

  const filter = { cardId: cardId };
  const update = {
    $setOnInsert: {
      dropTimestamp: Date.now(),
      potentialRecipients: [],
      dropperId: userId,
    },
  };
  const options = { upsert: true, returnDocument: "after" };

  const result = await collection.findOneAndUpdate(filter, update, options);

  return result.value;
}


async function getDropData(cardId) {
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("dropData");

  const dropData = await collection.findOne({ cardId: cardId });

  return dropData;
}

async function updateDropData(cardId, dropData) {
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("dropData");

  await collection.updateOne({ cardId: cardId }, { $set: dropData });
}
async function burnCard(cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const card = await cardCollection.findOne({ card_id: cardId });

    if (card && card.been_burnt) {
      throw new Error("Card has already been burned");
    }

    await cardCollection.updateOne(
      { card_id: cardId },
      { $set: { been_burnt: true } },
    );
  } catch (err) {
    console.error("Error burning card:", err);
    throw err;
  }
}

async function getCardsByUserIdAndTag(userId, tag) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const cards = await cardCollection
      .find({ user_id: userId, tag: tag, been_burnt: false })
      .toArray();
    return cards;
  } catch (err) {
    console.error("Error fetching cards by user ID and tag:", err);
    throw err;
  }
}

async function getTagSuggestions(input, userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");
    const player = await playerCollection.findOne({ user_id: userId });

    if (!player || !Array.isArray(player.tags)) {
      console.error(
        `No player found with user ID ${userId} or 'tags' field is not an array`,
      );
      return [];
    }

    const matchingTags = player.tags.filter((tag) =>
      tag.toUpperCase().startsWith(input.toUpperCase()),
    );
    return matchingTags;
  } catch (err) {
    console.error("Error fetching tag suggestions:", err);
    throw err;
  }
}

async function transferCardToAnotherPlayer(cardId, newUserId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const result = await cardCollection.updateOne(
      { card_id: cardId, been_burnt: false },
      { $set: { user_id: newUserId, tag: "" } },
    );
    return result;
  } catch (err) {
    console.error("Error transferring card:", err);
    throw err;
  }
}

async function transferCardsByTagToAnotherPlayer(userId, newUserId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const result = await cardCollection.updateMany(
      { user_id: userId, tag: tag, been_burnt: false },
      { $set: { user_id: newUserId } },
    );
    return result;
  } catch (err) {
    console.error("Error transferring cards by tag:", err);
    throw err;
  }
}

async function updateLastReceivedCard(userId, cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    // Get the player's data
    const playerCollection = db.collection("players");
    const player = await playerCollection.findOne({ user_id: userId });
    // If the player doesn't exist, return error
    if (!player) {
      throw new Error("Player not found");
    }
    // Update the player's last_card field
    const lastCard = await playerCollection.updateOne(
      { user_id: userId },
      { $set: { last_card: cardId } },
    );
    return lastCard;
  } catch (err) {
    console.error("Error updating last received card:", err);
    throw err;
  }
}

async function addGiftToInbox(
  fromUserId,
  toUserId,
  extraGrabs,
  extraDrops,
  currency,
  dominantDust,
  submissiveDust,
  conceptDust,
  objectDust,
  parts,
  fragments,
) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("giftinbox");

    let gift = {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      extra_grabs: extraGrabs,
      extra_drops: extraDrops,
      currency: currency,
      dominant_dust: dominantDust,
      submissive_dust: submissiveDust,
      concept_dust: conceptDust,
      object_dust: objectDust,
      parts: parts,
      fragments: fragments,
      timestamp: new Date(), // Add a timestamp
    };;

    const result = await giftInboxCollection.insertOne(gift);
    return result;
  } catch (err) {
    console.error("Error adding gift to inbox:", err);
    throw err;
  }
}

async function addCardGiftToInbox(fromUserId, toUserId, cardId, cardName) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardgiftInboxCollection = db.collection("cardgiftinbox");

    let gift = {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      card_id: cardId,
      card_name: cardName,
      timestamp: new Date(), // Add a timestamp
    };

    const result = await cardgiftInboxCollection.insertOne(gift);
    return result;
  } catch (err) {
    console.error("Error adding gift to inbox:", err);
    throw err;
  }
}

async function addTagGiftsToInbox(fromUserId, toUserId, cards) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("taggiftinbox");

    let gift = {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      card_ids: cards.map((card) => card.card_id),
      timestamp: new Date(), // Add a timestamp
    };

    const result = await giftInboxCollection.insertOne(gift);
    return result;
  } catch (err) {
    console.error("Error adding gifts to inbox:", err);
    throw err;
  }
}

async function transferCardToPending(cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const result = await cardCollection.updateOne(
      { card_id: cardId, been_burnt: false },
      { $set: { user_id: "pending" } },
    );
    return result;
  } catch (err) {
    console.error("Error transferring card:", err);
    throw err;
  }
}

async function transferCardsByTagToPending(userId, tag) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const cardCollection = db.collection("activecards");
    const result = await cardCollection.updateMany(
      { user_id: userId, tag: tag, been_burnt: false },
      { $set: { user_id: "pending" } },
    );
    return result;
  } catch (err) {
    console.error("Error transferring cards by tag:", err);
    throw err;
  }
}

async function getGiftsInInbox(userId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("giftinbox");
    const gifts = await giftInboxCollection
      .find({ to_user_id: userId })
      .toArray();

    return gifts;
  } catch (err) {
    console.error("Error getting gifts in inbox:", err);
    throw err;
  }
}

async function getGiftsFromUserInInbox(toUserId, fromUserId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("giftinbox");
    const gifts = await giftInboxCollection
      .find({ to_user_id: toUserId, from_user_id: fromUserId })
      .toArray();
    return gifts;
  } catch (err) {
    console.error("Error getting gifts from user in inbox:", err);
    throw err;
  }
}

async function acceptGift(
  userId,
  fromUserId,
  cardId,
  extraGrabs,
  extraDrops,
  currency,
  dominantDust,
  submissiveDust,
  conceptDust,
  objectDust,
  parts,
  fragments,
) {
  console.log(
    `Accepting gift: userId=${userId}, fromUserId=${fromUserId}, cardId=${cardId}, extraGrabs=${extraGrabs}, extraDrops=${extraDrops}, currency=${currency}, dominantDust=${dominantDust},submissiveDust=${submissiveDust}, conceptDust=${conceptDust}, objectDust=${objectDust}, parts=${parts}, fragments=${fragments}`,
  );

  try {
    // Retrieve all gifts from the user's inbox
    const gifts = await getGiftsFromUserInInbox(userId, fromUserId);
    for (const gift of gifts) {
      // Check if the gift matches the parameters
      if (
        gift.cardId === cardId &&
        gift.extraGrabs === extraGrabs &&
        gift.extraDrops === extraDrops &&
        gift.currency === currency &&
        gift.dominantDust === dominantDust &&
        gift.submissiveDust === submissiveDust &&
        gift.conceptDust === conceptDust &&
        gift.objectDust === objectDust &&
        gift.parts === parts &&
        gift.fragments === fragments
      ) {
        // Transfer the card to the user
        if (cardId) {
          await transferCardToAnotherPlayer(cardId, userId);
          // Update the user's last received card
          await updateLastReceivedCard(userId, cardId);
        }
        // Add the extra items to the user
        if (extraGrabs !== null && extraGrabs !== undefined)
          await updateExtraGrabs(userId, extraGrabs);
        if (extraDrops !== null && extraDrops !== undefined)
          await updateExtraDrops(userId, extraDrops);
        if (currency !== null && currency !== undefined)
          await updatePlayerCurrency(userId, currency);
        if (dominantDust !== null && dominantDust !== undefined)
          await updateDominantDust(userId, dominantDust);
        if (submissiveDust !== null && submissiveDust !== undefined)
          await updateSubmissiveDust(userId, submissiveDust);
        if (conceptDust !== null && conceptDust !== undefined)
          await updateConceptDust(userId, conceptDust);
        if (objectDust !== null && objectDust !== undefined)
          await updateObjectDust(userId, objectDust);
        if (parts !== null && parts !== undefined)
          await updatePlayerParts(userId, parts);
        if (fragments !== null && fragments !== undefined)
          await updatePlayerFragments(userId, fragments);
        // Remove the gift from the inbox
        await removeGiftFromInbox(
          userId,
          fromUserId,
          cardId,
          extraGrabs,
          extraDrops,
          currency,
          dominantDust,
          submissiveDust,
          conceptDust,
          objectDust,
          parts,
          fragments,
        );;
        // Break the loop
        break;
      }
    }
  } catch (err) {
    console.error("Error accepting gift:", err);
    throw err;
  }
}
async function removeGiftFromInbox(
  userId,
  fromUserId,
  cardId,
  extraGrabs,
  extraDrops,
  currency,
  dominantDust,
  submissiveDust,
  conceptDust,
  objectDust,
  parts,
  fragments,
) { 
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("giftinbox");
    let query;
    if (cardId) {
      query = { to_user_id: userId, card_id: cardId };
      const result = await giftInboxCollection.deleteOne(query);
      return result;
    } else {
      query = { from_user_id: fromUserId, to_user_id: userId };
      const gift = await giftInboxCollection.findOne(query);
      if (extraGrabs !== undefined) gift.extra_grabs -= extraGrabs;
      if (extraDrops !== undefined) gift.extra_drops -= extraDrops;
      if (currency !== undefined) gift.currency -= currency;
      if (dominantDust !== undefined) gift.dominant_dust -= dominantDust;
      if (submissiveDust !== undefined) gift.submissive_dust -= submissiveDust;
      if (conceptDust !== undefined) gift.concept_dust -= conceptDust;
      if (objectDust !== undefined) gift.object_dust -= objectDust;
      if (parts !== undefined) gift.parts -= parts;
      if (fragments !== undefined) gift.fragments -= fragments;
      if (
        gift.extra_grabs <= 0 &&
        gift.extra_drops <= 0 &&
        gift.currency <= 0 &&
        gift.dominant_dust <= 0 &&
        gift.submissive_dust <= 0 &&
        gift.concept_dust <= 0 &&
        gift.object_dust <= 0 &&
        gift.parts <= 0 &&
        gift.fragments <= 0
      ) {
        const result = await giftInboxCollection.deleteOne(query);
        return result;
      } else {
        await giftInboxCollection.updateOne(query, { $set: gift });
        return {
          message:
            "You still have gifts from this user. Don't forget to accept or reject them.",
        };
      }
    }
  } catch (err) {
    console.error("Error removing gift from inbox:", err);
    throw err;
  }
}

async function rejectGift(
  userId,
  fromUserId,
  cardId,
  extraGrabs,
  extraDrops,
  currency,
  dominantDust,
  submissiveDust,
  conceptDust,
  objectDust,
  parts,
  fragments,

) { 
  try {
    // Transfer the card back to the sender
    if (cardId) {
      await transferCardToAnotherPlayer(cardId, fromUserId);
    }
    // Add the extra items back to the sender
    if (extraGrabs !== null && extraGrabs !== undefined)
      await updateExtraGrabs(fromUserId, extraGrabs);
    if (extraDrops !== null && extraDrops !== undefined)
      await updateExtraDrops(fromUserId, extraDrops);
    if (currency !== null && currency !== undefined)
      await updatePlayerCurrency(fromUserId, currency);
    if (dominantDust !== null && dominantDust !== undefined)
      await updateDominantDust(fromUserId, dominantDust);
    if (submissiveDust !== null && submissiveDust !== undefined)
      await updateSubmissiveDust(fromUserId, submissiveDust);
    if (conceptDust !== null && conceptDust !== undefined)
      await updateConceptDust(fromUserId, conceptDust);
    if (objectDust !== null && objectDust !== undefined)
      await updateObjectDust(fromUserId, objectDust);
    if (parts !== null && parts !== undefined)
      await updatePlayerParts(fromUserId, parts);
    if (fragments !== null && fragments !== undefined)
      await updatePlayerFragments(fromUserId, fragments);
    // Remove the gift from the inbox
    await removeGiftFromInbox(
      userId,
      fromUserId,
      cardId,
      extraGrabs,
      extraDrops,
      currency,
      dominantDust,
      submissiveDust,
      conceptDust,
      objectDust,
      parts,
      fragments,
    );;
  } catch (err) {
    console.error("Error rejecting gift:", err);
    throw err;
  }
}

async function getGiftInInboxByCardId(userId, cardId) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const giftInboxCollection = db.collection("giftinbox");
    const gift = await giftInboxCollection.findOne({
      to_user_id: userId,
      card_id: cardId,
    });
    
    return gift;
  } catch (err) {
    console.error("Error getting gift in inbox:", err);
    throw err;
  }
}

// Export the function
module.exports = {
  addCards,
  addPlayer,
  addFrame,
  generateId,
  getCards,
  addCardToUserCollection,
  markDealt,
  checkIfPlayer,
  updatePlayerDropCooldown,
  getPlayerDropCooldown,
  updateGrabCooldown,
  getGrabCooldown,
  resetDealtCards,
  createSubmission,
  getPlayer,
  updateExtraGrabs,
  updatePlayerCurrency,
  updatePlayerDust,
  updatePlayerParts,
  updatePlayerFragments,
  updateExtraDrops,
  getCard,
  getCardsByUserId,
  updateExtraDrops,
  getLastCollectedCard,
  updateLastCollectedCard,
  getCardSuggestions,
  updateCardTag,
  getLastCard,
  addTagToArray,
  removeTagFromArray,
  ownedCardSuggestions,
  getCardById,
  initializeDropData,
  getDropData,
  updateDropData,
  burnCard,
  getCardsByUserIdAndTag,
  getTagSuggestions,
  transferCardToAnotherPlayer,
  transferCardsByTagToAnotherPlayer,
  updateLastReceivedCard,
  addGiftToInbox,
  transferCardToPending,
  transferCardsByTagToPending,
  getGiftsInInbox,
  getGiftsFromUserInInbox,
  acceptGift,
  rejectGift,
  removeGiftFromInbox,
  getGiftInInboxByCardId,
  addCardGiftToInbox,
  addTagGiftsToInbox,
};
