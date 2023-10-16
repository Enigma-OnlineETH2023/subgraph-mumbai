import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import { NewCollectionDeployed } from "../generated/Factory/Factory"

export function createNewCollectionDeployedEvent(
  collectionAddress: Address,
  name: string,
  symbol: string
): NewCollectionDeployed {
  let newCollectionDeployedEvent = changetype<NewCollectionDeployed>(
    newMockEvent()
  )

  newCollectionDeployedEvent.parameters = new Array()

  newCollectionDeployedEvent.parameters.push(
    new ethereum.EventParam(
      "collectionAddress",
      ethereum.Value.fromAddress(collectionAddress)
    )
  )
  newCollectionDeployedEvent.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromString(name))
  )
  newCollectionDeployedEvent.parameters.push(
    new ethereum.EventParam("symbol", ethereum.Value.fromString(symbol))
  )

  return newCollectionDeployedEvent
}
