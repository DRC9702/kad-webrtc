/**
* @module kad-webrtc/transport
*/

'use strict';

var assert = require('assert');
var hat = require('hat');
var inherits = require('util').inherits;
var WebRTCContact = require('./contact');
var RPC = require('kad').RPC;
var SimplePeer = require('simple-peer');
var Logger = require('kad').Logger;
var wrtc = require('wrtc');


inherits(WebRTCTransport, RPC);

/**
* Represents an RPC interface over WebRTC
* @constructor
* @param {object} contact
* @param {object} options
*/
function WebRTCTransport(contact, options) {
  if (!(this instanceof WebRTCTransport)) {
    return new WebRTCTransport(contact, options);
  }

  assert(contact instanceof WebRTCContact, 'Invalid contact supplied');
  assert(typeof options === 'object', 'Invalid options were supplied');
  assert(
    typeof options.signaller === 'object',
    'Invalid signaller was supplied'
  );

  this._signaller = options.signaller;
  this._wrtc = require('wrtc');//options.wrtc;

  RPC.call(this, contact, options);
}

/**
* Setup WebRTC transport
* #_open
* @param {function} ready
*/
WebRTCTransport.prototype._open = function(ready) {
  this._peers = {};
  this._handshakesToContacts = {};
  this._contactIdsToPeers = {};
  this._signalHandler = this._onSignal.bind(this);
  this._signaller.addListener(this._contact.nick, this._signalHandler);

  setTimeout(function() {
    ready();
  });
};

/**
* Handle a message sent through `_signaller` from another peer
* #_onSignal
* @param {object} signallerMessage
*/
WebRTCTransport.prototype._onSignal = function(signallerMessage) {
    var rcLogger = new Logger(4);
    rcLogger.info("DRC WebRTCTransport._onSignal() being called");
    rcLogger.info("DRC signallerMessage:" + JSON.stringify(signallerMessage));
  var self = this;
  var signal = signallerMessage.signal;
  var sender = signallerMessage.sender;
  var handshakeID = signallerMessage.handshakeID;
  var peer = null;
  if(this._handshakesToContacts[signallerMessage.handshakeID]
      && this._contactIdsToPeers[this._handshakesToContacts[signallerMessage.handshakeID].nodeID]) {
    var tempID = this._handshakesToContacts[signallerMessage.handshakeID].nodeID;
    rcLogger.info("DRC tempID:" + tempID);
    peer = this._contactIdsToPeers[tempID];
    rcLogger.info("DRC peer:" + JSON.stringify(peer));
  }
  if(!peer || peer.destroyed){
      peer = this._peers[signallerMessage.handshakeID];
  }
  if(!peer || peer.destroyed) {
    peer = this._createPeer(sender, handshakeID, false);
    //ToDo: Figure out how to replace this call

    peer.on('data', function(data) {
      var buffer = new Buffer(data);
      self.receive(buffer, { nick: signallerMessage.sender });
      // peer.destroy();
    });
  }
  peer.signal(signal);
};

/**
* Send a RPC to the given contact
* #_send
* @param {buffer} data
* @param {Contact} contact
*/
WebRTCTransport.prototype._send = function(data, contact) {
  var self = this;
  var handshakeID = hat();
  var rcLogger = new Logger(4);

  if(!this._contactIdsToPeers[contact.nodeID] || !this._contactIdsToPeers[contact.nodeID].destroyed){
    rcLogger.info("DRC this._contactIdsToPeers[contact.nodeID]" + !!this._contactIdsToPeers[contact.nodeID]);
    rcLogger.info("DRC Creating new peer inside _send!");
    this._handshakesToContacts[handshakeID] = contact;
    this._contactIdsToPeers[contact.nodeID] = this._createPeer(contact.nick, handshakeID, true);
  }
  else {
    rcLogger.info("DRC Using old peer inside _send!");
  }
    var peer = this._contactIdsToPeers[contact.nodeID];
    peer.on('connect', function() {
      peer.send(data.toString());
    // setTimeout(function() {
    //   newPeer.destroy();
    // }, 1000);
  });
};

/**
* Initialize a WebRTC peer and store it in `_peers`
* #_createPeer
* @param {string} nick
* @param {string} handshakeID
* @param {boolean} initiator
*/
WebRTCTransport.prototype._createPeer = function(nick, handshakeID, initiator) {
  var rcLogger = new Logger(4)
  rcLogger.info("DRC WebRTCTransport._createPeer() being called");
  var self = this;
  var peer = new SimplePeer({ wrtc: this._wrtc, initiator: initiator });
  peer.on('signal', function(signal) {
    self._signaller.emit(nick, {
      sender: self._contact.nick,
      handshakeID: handshakeID,
      signal: signal
    });
  });
  peer.on('error', function(err) {
    self._log.error('peer encountered an error %s', err.message);
  });
  peer.once('close', function() {
    peer.removeAllListeners('data');
    peer.removeAllListeners('signal');
    peer.removeAllListeners('error');
    delete self._peers[handshakeID];
  });
  this._peers[handshakeID] = peer;
  return peer;
};

/**
* Close the underlying socket
* #_close
*/
WebRTCTransport.prototype._close = function() {
  var rcLogger = new Logger(4)
  rcLogger.info("DRC WebRTCTransport._close() being called");
  var self = this;
  Object.keys(this._peers).forEach(function(handshakeID) {
    self._peers[handshakeID].destroy();
  });
  this._peers = {};
  this._handshakesToContacts = {}
  this._contactIdsToPeers = {}
  Object.keys(this._contactIdsToPeers).forEach(function(contactID) {
      self._contactIdsToPeers[contactID].destroy();
  });
  this._signaller.removeListener(this._contact.nick, this._signalHandler);
};

module.exports = WebRTCTransport;
