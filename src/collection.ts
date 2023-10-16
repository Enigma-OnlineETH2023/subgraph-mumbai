import { BigInt, Address, log, Bytes } from "@graphprotocol/graph-ts";
import {
  Collection,
  Token,
  Approval,
  TokenMinted,
  Transfer,
  TokenMetadataSet
} from "../generated/schema";

import {
  Collection as CollectionContract,
  Approval as ApprovalEvent,
  TokenMinted as TokenMintedEvent,
  Transfer as TransferEvent,
  TokenMetadataUpdated as TokenMetadataUpdatedEvent,
} from "../generated/Factory/Collection";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function _createOrLoadToken(
  collection: Collection,
  tokenID: BigInt
): Token {
  const tokenIdStr = tokenID.toString();
  const tokenKey = collection.id + tokenIdStr;

  let token = Token.load(tokenKey);
  if (token) return token;

  token = new Token(tokenKey);
  token.collection = collection.id;
  token.tokenId = tokenID;
  token.publicURI = "";
  token.owner = Address.fromString(ZERO_ADDRESS);
  token.encryptedPrivateURI = Bytes.fromHexString("0x");
  token.originalHashPrivateURI = Bytes.fromHexString("0x");
  token.hashPrivateURI = Bytes.fromHexString("0x");
  token.save();

  collection.tokensCount = collection.tokensCount + 1;
  collection.save();

  return token;
}

export function updateToken(token: Token): void {
  const bindedCollection = CollectionContract.bind(Address.fromString(token.collection));

  const publicURI = bindedCollection.try_tokenURI(token.tokenId);
  const privateURI = bindedCollection.try_privateTokenURI(token.tokenId);
  const owner = bindedCollection.try_ownerOf(token.tokenId);

  if (publicURI.reverted || owner.reverted || privateURI.reverted) {
    log.error("Failed to update token due to contract call reversion", []);
    return;
  }

  token.publicURI = publicURI.value;
  token.owner = owner.value;
  token.encryptedPrivateURI = privateURI.value.getEncryptedPrivateURI();
  token.hashPrivateURI = privateURI.value.getHashPrivateURI();
  token.originalHashPrivateURI = privateURI.value.getOriginalHashPrivateURI();
  token.save();
}

export function handleApproval(event: ApprovalEvent): void {
  const collection = Collection.load(event.address.toHexString());
  if (!collection) {
    log.error("Collection not found", []);
    return;
  }

  const token = _createOrLoadToken(collection, event.params.tokenId);

  const approval = new Approval(event.transaction.hash.toHexString());
  approval.token = token.id;
  approval.owner = event.params.owner;
  approval.approved = event.params.approved;
  approval.blockNumber = event.block.number;
  approval.blockTimestamp = event.block.timestamp;
  approval.transactionHash = event.transaction.hash;
  approval.save();
}

export function handleTokenMinted(event: TokenMintedEvent): void {
  const collection = Collection.load(event.address.toHexString());
  if (!collection) {
    log.error("Collection not found", []);
    return;
  }

  const token = _createOrLoadToken(collection, event.params.tokenID);
  token.owner = event.params.owner;
  token.save();

  const tokenMinted = new TokenMinted(event.transaction.hash.toHexString());
  tokenMinted.token = token.id;
  tokenMinted.owner = event.params.owner;
  tokenMinted.blockNumber = event.block.number;
  tokenMinted.blockTimestamp = event.block.timestamp;
  tokenMinted.transactionHash = event.transaction.hash;
  tokenMinted.save();

  updateToken(token);
}

export function handleTransfer(event: TransferEvent): void {
  const tokenKey = event.address.toHexString() + event.params.tokenId.toString();
  const token = Token.load(tokenKey);
  if (!token) {
    log.error("Token not found", []);
    return;
  }

  token.owner = event.params.to;
  token.save();

  const transfer = new Transfer(event.transaction.hash.toHexString());
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.token = token.id;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}

export function handleMetadataUpdated(event: TokenMetadataUpdatedEvent): void {
  const collection = Collection.load(event.address.toHexString());
  if (!collection) {
    log.error("Collection not found", []);
    return;
  }

  const token = _createOrLoadToken(collection, event.params.tokenID);
  token.encryptedPrivateURI = event.params.newMetadata.encryptedPrivateURI;
  token.hashPrivateURI = event.params.newMetadata.hashPrivateURI;
  token.save();

  const metadataSet = new TokenMetadataSet(event.transaction.hash.toHexString());
  metadataSet.token = token.id;
  metadataSet.encryptedPrivateURI = event.params.newMetadata.encryptedPrivateURI;
  metadataSet.hashPrivateURI = event.params.newMetadata.hashPrivateURI;
  metadataSet.publicURI = event.params.newMetadata.publicURI;
  metadataSet.blockNumber = event.block.number;
  metadataSet.blockTimestamp = event.block.timestamp;
  metadataSet.transactionHash = event.transaction.hash;
  metadataSet.save();

  updateToken(token);
}

