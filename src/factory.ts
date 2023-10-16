import { Address, ethereum, log } from "@graphprotocol/graph-ts";
import {
  Factory,
  Collection,
  CollectionDeployed,
  Token,
} from "../generated/schema";

import {
  NewCollectionDeployed,
  Factory as FactoryContract,
} from "../generated/Factory/Factory";
import { Collection as CollectionTemplate } from "../generated/templates";
import { updateToken } from "./collection";

import { FACTORY_ADDRESS as FACTORY_ADDRESS_STR } from "./helpers";

const FACTORY_ADDRESS = Address.fromString(FACTORY_ADDRESS_STR);

function getOrCreateFactory(event: NewCollectionDeployed): Factory | null {
  let factory = Factory.load(FACTORY_ADDRESS_STR);
  if (factory != null) return factory;

  log.debug("Creating a new Factory", []);

  const bindedFactory = FactoryContract.bind(FACTORY_ADDRESS);
  const implementation = bindedFactory.try_secretNFTContractImplementation();

  if (implementation.reverted) {
    log.error("Factory: No implementation found", []);
    return null;
  }

  factory = new Factory(FACTORY_ADDRESS_STR);
  factory.collectionsCount = 0;
  factory.collectionImplementation = implementation.value;
  factory.lastSnapshotBlockTimestamp = event.block.timestamp;
  factory.lastSnapshotBlockNumber = event.block.number;
  factory.save();

  return factory;
}

function createCollection(event: NewCollectionDeployed, factory: Factory): Collection {
  const collectionAddressStr = event.params.collectionAddress.toHexString();

  let collection = Collection.load(collectionAddressStr);
  if (collection != null) return collection;

  log.debug("Creating a new Collection", []);

  collection = new Collection(collectionAddressStr);
  collection.collection = event.params.collectionAddress;
  collection.factory = factory.id;
  collection.name = event.params.name;
  collection.symbol = event.params.symbol;
  collection.tokensCount = 0;
  collection.save();

  return collection;
}

export function handleNewBlock(block: ethereum.Block): void {
  let factory = Factory.load(FACTORY_ADDRESS_STR);
  if (factory === null) {
    log.debug("No Factory entity yet", []);
    return;
  }

  const bindedFactory = FactoryContract.bind(FACTORY_ADDRESS);
  const collectionContractImplementation = bindedFactory.try_secretNFTContractImplementation();
  const collectionsAddresses = bindedFactory.try_getCollectionsAddresses();

  if (collectionContractImplementation.reverted || collectionsAddresses.reverted) {
    log.error("Error fetching implementation or collections addresses from factory", []);
    return;
  }

  for (let i = 0; i < collectionsAddresses.value.length; i++) {
    const collectionAddress = collectionsAddresses.value[i].toHexString();
    const collection = Collection.load(collectionAddress);

    if (collection === null) continue;

    for (let j = 0; j < collection.tokensCount; j++) {
      const tokenIdStr = collectionAddress + j.toString();
      let token = Token.load(tokenIdStr);
      if (token === null) continue;

      updateToken(token);
      token.save();
    }
  }

  factory.collectionImplementation = collectionContractImplementation.value;
  factory.lastSnapshotBlockTimestamp = block.timestamp;
  factory.lastSnapshotBlockNumber = block.number;
  factory.save();
}

export function handleCreateCollection(event: NewCollectionDeployed): void {
  let factory = getOrCreateFactory(event);
  if (factory === null) return;

  const collection = createCollection(event, factory);

  CollectionTemplate.create(event.params.collectionAddress);

  const collectionDeployed = new CollectionDeployed(event.params.collectionAddress.toHexString());
  collectionDeployed.collection = collection.id;
  collectionDeployed.blockNumber = event.block.number;
  collectionDeployed.blockTimestamp = event.block.timestamp;
  collectionDeployed.transactionHash = event.transaction.hash;
  collectionDeployed.save();

  factory.collectionsCount = factory.collectionsCount + 1;
  factory.save();
}
