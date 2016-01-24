var SpurEvents = require('spur-events');
var addListener = SpurEvents.addListener;
var removeListener = SpurEvents.removeListener;
var interationLock = require('spur-interaction-lock');

var current = {};

function onLock(lockNode) {
  for (var pointerId in current) {
    var DOMNode = current[pointerId].DOMNode;
    if (DOMNode === lockNode) { return; }
    while (lockNode !== null) {
      if (lockNode === DOMNode) { current[pointerId].cancel(); }
      lockNode = lockNode.parentNode;
    }
  }
}

const LONG_TAP_TIMEOUT = 400;

function ButtonPlugin(component) {
  this.component = component;
  this.enable = true;
  this.lockId = null;
}

ButtonPlugin.prototype.press = function(coords) {
  if (this.component.onPress) { this.component.onPress(coords); }
  if (this.component.props.onPress) { this.component.props.onPress(coords); }
};

ButtonPlugin.prototype.release = function(cancelled) {
  if (this.component.onRelease) { this.component.onRelease(cancelled); }
  if (this.component.props.onRelease) { this.component.props.onRelease(cancelled); }
};

ButtonPlugin.prototype.tap = function() {
  if (this.component.onTap) { this.component.onTap(); }
  if (this.component.props.onTap) { this.component.props.onTap(); }
};

ButtonPlugin.prototype.longTap = function(coords) {
  if (this.component.onLongTap) { this.component.onLongTap(); }
  if (this.component.props.onLongTap) { this.component.props.onLongTap(); }
};

ButtonPlugin.prototype.setEnable = function(enable) {
  this.enable = enable;
};

ButtonPlugin.prototype.reset = function() {
  if (current[this.pointerId] === this) { current[this.pointerId] = null };
  if (this.lockId) {
    interationLock.releaseLock(this.lockId);
    this.lockId = null;
  }
  interationLock.removeListener('lock', onLock);
  window.clearTimeout(this.longTapTimeout);
  removeListener(document, 'pointermove', this.onPointerMove, { context: this });
  removeListener(document, 'pointerup', this.onPointerUp, { context: this });
};

ButtonPlugin.prototype.cancel = function() {
  if (current[this.pointerId] === this) {
    this.cancelled = true;
    this.release(true);
  }

  this.reset();
};

ButtonPlugin.prototype.onPointerMove = function(e) {
  if (e.clientX < this.boundingBox.left ||
    e.clientX > this.boundingBox.left + this.boundingBox.width ||
    e.clientY < this.boundingBox.top ||
    e.clientY > this.boundingBox.top + this.boundingBox.height) {
    this.cancel();
  }
};

ButtonPlugin.prototype.onPointerDown = function(e) {
  if (current[e.pointerId] || !this.enable || e.originalEvent.which === 3) { return; }
  current[e.pointerId] = this;
  this.pointerId = e.pointerId;
  interationLock.on('lock', onLock);
  this.cancelled = false;
  var startTap = {
    x: e.clientX,
    y: e.clientY
  }

  this.boundingBox = this.DOMNode.getBoundingClientRect();
  this.press(startTap);

  this.longTapped = false;
  if (this.component.onLongTap || this.component.props.onLongTap) {
    window.clearTimeout(this.longTapTimeout);
    var self = this;
    this.longTapTimeout = window.setTimeout(function () {
      if (self.lockId = interationLock.requestLockOn(self.DOMNode)){
        self.longTap(startTap);
        self.longTapped = true;
      }
    }, LONG_TAP_TIMEOUT);
  }

  addListener(document, 'pointermove', this.onPointerMove, { context: this });
  addListener(document, 'pointerup', this.onPointerUp, { context: this });
};

ButtonPlugin.prototype.onPointerUp = function() {
  if (this.cancelled) {
    return;
  }

  this.reset();
  this.release();

  if (!this.longTapped) {
    this.tap();
  }
};

ButtonPlugin.prototype.componentDidMount = function(DOMNode) {
  this.DOMNode = DOMNode;
  addListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
};

ButtonPlugin.prototype.componentWillUnmount = function() {
  removeListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
  this.reset();
  this.DOMNode = null;
}

module.exports = ButtonPlugin;