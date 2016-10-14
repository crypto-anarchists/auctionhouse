var accounts;
var account;
var auctions;
var auctionHouseContract;
var auction;
var currentBlockNumber;

function setStatus(message) {
  var status = document.getElementById("statusMessage");
  status.innerHTML = message;
};

function updateAddress() {
    var address = document.getElementById("address");
    address.innerHTML = account;
}

function refreshAuction() {
    var auctionId = getParameterByName("auctionId");
    var ah = AuctionHouse.deployed();
    auction = {"auctionId": auctionId};

    auctionHouseContract.getAuctionCount.call().then(function(auctionCount) {
      // console.log(auctionCount.toNumber());
      if (auctionCount.toNumber() < auctionId) {
        setStatus("Cannot find auction: " + auctionId);
        throw new Error();
        //Redirect to 404 page
      }
    });

    ah.getStatus.call(auctionId).then(function(auctionStatus) {
      // console.log("status:" + auctionStatus);
      if (auctionStatus == 0) {
        auction["status"] = "Pending";
      } else if (auctionStatus == 1) {
        auction["status"] = "Active";
      } else if (auctionStatus == 2) {
        auction["status"] = "Inactive";
      } else {
        alert("Unknown status: " + auctionStatus);
        // console.log("Unknown status: " + auctionStatus);
      }

      ah.getAuction.call(auctionId).then(function(result) {
        auction["seller"] = result[0];
        auction["contractAddress"] = result[1];
        auction["recordId"] = result[2];
        auction["title"] = result[3];
        auction["description"] = result[4];
        auction["blockNumberOfDeadline"] = result[5].toNumber();
        auction["distributionCut"] = result[6].toNumber();
        auction["distributionAddress"] = result[7]
        auction["startingPrice"] = result[8].toNumber();
        auction["reservePrice"] = result[9].toNumber();
        auction["currentBid"] = result[10].toNumber();
        auction["bidCount"] = result[11].toNumber();


        var container = document.getElementById("auction_container");
        container.innerHTML = constructAuctionView(auction);

      });

    });

}

// function activateAuction(auctionId, recordId) {
function activateAuction() {
  //Transfer ownership to the contract
  var sn = SampleName.deployed();
  console.log(auction["recordId"]);
  console.log(auctionHouseContract.address);

  sn.setOwner(auction["recordId"], auctionHouseContract.address, {from: account, gas: 500000}).then(function(txnId) {
    console.log("set owner transaction: " + txnId);
    //Activate the auction
    auctionHouseContract.activateAuction(auction["auctionId"], {from: account, gas: 500000}).then(function(txnId) {
      console.log(txnId);
      refreshAuction();
    });
  });
}

function placeBid() {
    var bid = document.getElementById("bid_value").value;
    bid = web3.toWei(bid, "ether");

    setStatus("Bid is being placed, hang tight...")

    if (bid < auction["currentBid"]) {
	setStatus("Bid has to be at least " + auction["currentBid"]);
	return;
    }

    console.log({from:account, value:bid, gas: 1400000});

    var gas = 1400000;
    auctionHouseContract.placeBid(auction["auctionId"], {from:account, value:bid, gas: gas}).then(function(txnId) {
	console.log("Bid txnId: " + txnId);
	web3.eth.getTransactionReceipt(txnId, function(err, txnReceipt) {
	    if (txnReceipt.gasUsed == gas) {
		console.log("We had a failed bid " + txnReceipt);
		setStatus("Bid failed");
	    } else {
		console.log("We had a successful bid " + txnReceipt);
		setStatus("Bid succeeded!");
	    }
	});
	refreshAuction();
    });
}

function endAuction() {
  auctionHouseContract.endAuction(auction["auctionId"], {from:account, gas: 1400000}).then(function(txnId) {
    console.log("End auction txnId: " + txnId)
    refreshAuction();
  });
}

function isOwner() {
  return true;
}

function constructAuctionView(auction) {
  result = "<div id='status'>Status: " + auction["status"] + "</div>";
  result += "<div id='seller_address'>Seller: " + auction["seller"] + "</div>";
  result += "<div id='title'>Title: " + auction["title"] + "</div>";
  result += "<div id='description'>Description: " + auction["description"] + "</div>";
    result += "<div id='currentBid'>Current Bid: " + web3.fromWei(auction["currentBid"], "ether") + " ETH</div>";
  result += "<div id='bidCount'>Number of Bids: " + auction["bidCount"] + "</div>";
  result += "<div id='deadline'>Deadline Block Number: " + auction["blockNumberOfDeadline"] + "</div>";

  //Activate auction button
  if (auction["status"] == "Pending" && isOwner()) {
    result += "<button id='activation_button' onclick='activateAuction()'>Activate Auction</button>";
  } 

  //Place bid button
  if (auction["status"] == "Active" && currentBlockNumber <= auction["blockNumberOfDeadline"]) {
    result += "<label for='bid_value'>Bid (in eth):</label><input type='text' id='bid_value' placeholder='eg 3.0'></input>";
    result += "<button id='bid_button' onclick='placeBid()'>Place Bid</button>";
  }

  //End auction button
  if (auction["status"] == "Active" && auction["seller"] == account && currentBlockNumber > auction["blockNumberOfDeadline"]) {
    result += "<button id='end_button' onclick='endAuction()'>End Auction</button>";
  }

  return result;
}

function createAuction() {
    var sn = SampleName.deployed();
    var ah = AuctionHouse.deployed();
    var marketer = "0x536d6b87f21d8bbf23dd7f33fc3ca90e85cba0b6";

    setAuctionStatus("Initiating auction, please wait.");

    var recordId = document.getElementById("nameToAuction").value;
    sn.owner.call(recordId).then(function(res) {
	if (!(res === account)) {
	    setAuctionStatus("Looks like you don't own that name");
	    return;
	}
	var startingPrice = web3.toWei(parseFloat(document.getElementById("startingPrice").value), "ether");
	var reservePrice = web3.toWei(parseFloat(document.getElementById("reservePrice").value), "ether");
	var deadline = web3.eth.blockNumber + parseInt(document.getElementById("deadline").value);
	console.log("Setting deadline to " + deadline + " and current block num is " + web3.eth.blockNumber);
	console.log("Prices, starting/reserve " + startingPrice + "/" + reservePrice);
	console.log("Marketer is: " + marketer);

	ah.createAuction(recordId,
			 "Auction for this unique name!",
			 sn.address,
			 recordId,
			 deadline,
			 startingPrice,
			 reservePrice,
			 10,
			 marketer,
			 {from: account, gas:500000}).then(function(txId) {

			     setAuctionStatus("Auction created in transaction: " + txId);
			     refreshAuction();
			 });
    });
};

window.onload = function() {
  auctionHouseContract = AuctionHouse.deployed();

  $("#header").load("header.html"); 
  $("#footer").load("footer.html"); 

  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

      accounts = accs;
      account = accounts[0];

      updateAddress();
      refreshAuction();
      updateBlockNumber();
      watchEvents();
  });
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}


function watchEvents() {
    var ah = AuctionHouse.deployed();
    var events = ah.allEvents();

    events.watch(function(err, msg) {
      if(err) {
          console.log("Error: " + err);
      } else { 
          console.log("Got an event: " + msg.event);
      }
        });

        var filter = web3.eth.filter("latest");
        filter.watch(function(err, block) {
      // Call get block number on every block
      updateBlockNumber();
    });
}


function updateBlockNumber() {
    web3.eth.getBlockNumber(function(err, blockNumber) {
  currentBlockNumber = blockNumber;
  console.log("Current block number is: " + blockNumber);
    });
}
