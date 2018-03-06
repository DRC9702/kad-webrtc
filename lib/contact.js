/**
* @module kad-webrtc/contact
*/

'use strict';

var assert = require('assert');
var kademlia = require('kad');
var Contact = kademlia.Contact;
var utils = kademlia.utils;
var inherits = require('util').inherits;
var Logger = require('kad').Logger;


inherits(WebRTCContact, Contact);

/**
* Represent a WebRTC contact
* @constructor
* @param {object} options
*/
function WebRTCContact(options) {
  if (!(this instanceof WebRTCContact)) {
    return new WebRTCContact(options);
  }

  var rcLogger = new Logger(4);
  rcLogger.info("DRC WebRTContact constructor!");

  assert(options instanceof Object, 'Invalid options were supplied');
  assert(typeof options.nick === 'string', 'Invalid nick was supplied');

  this.nick = options.nick;
  this.peerConnection = null;

  Contact.call(this, options);
}

/**
* Generate a NodeID by taking the SHA1 hash of the nickname
* #_createNodeID
*/
WebRTCContact.prototype._createNodeID = function() {
  return utils.createID(this.nick);
};

/**
* Generate a user-friendly string for the contact
* #_toString
*/
WebRTCContact.prototype.toString = function() {
  return this.nick;
};

module.exports = WebRTCContact;
