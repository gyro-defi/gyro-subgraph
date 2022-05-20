import { BigInt } from "@graphprotocol/graph-ts";
import {
  ProposalCreated as ProposalCreatedEvent,
  VoteCast as VoteCastEvent,
} from "../generated/Governor/Governor";

import { ProposalCreated, VoteCast } from "../generated/schema";

export function handleProposalCreated(event: ProposalCreatedEvent): void {
  let entity = new ProposalCreated(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  entity.proposalId = event.params.id;
  entity.proposer = event.params.proposer;
  entity.startBlock = event.params.startBlock;
  entity.endBlock = event.params.endBlock;
  entity.description = event.params.description;

  entity.save();
}

export function handleVoteCast(event: VoteCastEvent): void {
  let entity = new VoteCast(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  entity.voter = event.params.voter;
  entity.proposalId = event.params.proposalId;
  entity.support = BigInt.fromI32(event.params.support);
  entity.votes = event.params.votes;

  entity.save();
}
