var SpurEvents = require('spur-events');
var addListener = SpurEvents.addListener;
var removeListener = SpurEvents.removeListener;
var interationLock = require('spur-interaction-lock');

var current = {};

addListener(window, 'pointerup', function (e) {
	delete current[e.pointerId];
});

function onLock(lockNode) {
	for (var pointerId in current) {
		var DOMNode = current[pointerId].DOMNode;
		while (lockNode !== null) {
			if (lockNode === DOMNode) { current[pointerId].cancel(); }
			lockNode = lockNode.parentNode;
		}
	}
}

function onContainerLock(lockNode) {
	for (var pointerId in current) {
		var DOMNode = current[pointerId].DOMNode;
		while (DOMNode !== null) {
			if (lockNode === DOMNode) { current[pointerId].cancel(); }
			DOMNode = DOMNode.parentNode;
		}
	}
}

var LONG_TAP_TIMEOUT = 700;
var DOUBLE_TAP_TIMEOUT = 300;

function ButtonPlugin(component) {
	this.component = component;
	this.enable = true;
	this.lockId = null;
	this.lastTap = 0;
}

ButtonPlugin.plugName = 'button';

ButtonPlugin.prototype.press = function (coords) {
	if (this.component.onPress) { this.component.onPress(coords); }
	if (this.component.props.onPress) { this.component.props.onPress(this.component, coords); }
};

ButtonPlugin.prototype.release = function (cancelled) {
	if (this.component.onRelease) { this.component.onRelease(cancelled); }
	if (this.component.props.onRelease) { this.component.props.onRelease(this.component, cancelled); }
};

ButtonPlugin.prototype.tap = function (e) {
	if (this.component.onTap) { this.component.onTap(e); }
	if (this.component.props.onTap) { this.component.props.onTap(this.component, e); }
	this.lastTap = Date.now();
};

ButtonPlugin.prototype.doubleTap = function (e) {
	if (this.component.onDoubleTap) { this.component.onDoubleTap(e); }
	if (this.component.props.onDoubleTap) { this.component.props.onDoubleTap(this.component, e); }
	this.lastTap = 0;
};

ButtonPlugin.prototype.longTap = function (coords) {
	if (this.component.onLongTap) { this.component.onLongTap(coords); }
	if (this.component.props.onLongTap) { this.component.props.onLongTap(this.component, coords); }
};

ButtonPlugin.prototype.setEnable = function (enable) {
	this.enable = enable;
};

ButtonPlugin.prototype.reset = function () {
	if (current[this.pointerId] === this) { delete current[this.pointerId]; }
	if (this.lockId) {
		interationLock.releaseLock(this.lockId);
		this.lockId = null;
	}
	interationLock.removeListener('lock', onLock);
	interationLock.removeListener('container-lock', onContainerLock);
	window.clearTimeout(this.longTapTimeout);
	removeListener(document, 'pointermove', this.onPointerMove, { context: this });
	removeListener(document, 'pointerup', this.onPointerUp, { context: this });
};

ButtonPlugin.prototype.cancel = function () {
	if (current[this.pointerId] === this) {
		this.cancelled = true;
		this.release(true);
	}

	this.reset();
};

ButtonPlugin.prototype.onPointerMove = function (e) {
	if (e.clientX < this.boundingBox.left ||
		e.clientX > this.boundingBox.left + this.boundingBox.width ||
		e.clientY < this.boundingBox.top ||
		e.clientY > this.boundingBox.top + this.boundingBox.height) {
		this.cancel();
	}
};

ButtonPlugin.prototype.onPointerDown = function (e) {
	if (current[e.pointerId] || !this.enable || e.originalEvent.which === 3 || interationLock.isLocked(e.target)) {
		return;
	}
	current[e.pointerId] = this;
	this.pointerId = e.pointerId;
	interationLock.on('lock', onLock);
	interationLock.on('container-lock', onContainerLock);
	this.cancelled = false;
	var startTap = {
		x: e.clientX,
		y: e.clientY
	};

	var target = e.target;

	this.boundingBox = this.DOMNode.getBoundingClientRect();
	this.press(startTap);

	this.longTapped = false;
	if (this.component.onLongTap || this.component.props.onLongTap) {
		window.clearTimeout(this.longTapTimeout);
		var self = this;
		this.longTapTimeout = window.setTimeout(function () {
			interationLock.removeListener('lock', onLock);
			interationLock.removeListener('container-lock', onContainerLock);
			self.lockId = interationLock.requestLockOn(target);
			if (self.lockId) {
				self.longTap(startTap);
				self.longTapped = true;
			}
		}, LONG_TAP_TIMEOUT);
	}

	addListener(document, 'pointermove', this.onPointerMove, { context: this });
	addListener(document, 'pointerup', this.onPointerUp, { context: this });
};

ButtonPlugin.prototype.onPointerUp = function (e) {
	if (this.cancelled) {
		return;
	}

	this.reset();
	this.release();

	if (!this.longTapped) {
		var tapDiff = Date.now() - this.lastTap;
		this.tap(e);
		if (tapDiff < DOUBLE_TAP_TIMEOUT) {
			this.doubleTap(e);
			return;
		}
	}
};

ButtonPlugin.prototype.componentDidMount = function (DOMNode) {
	this.DOMNode = DOMNode;
	addListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
};

ButtonPlugin.prototype.componentWillUnmount = function () {
	removeListener(this.DOMNode, 'pointerdown', this.onPointerDown, { context: this });
	this.reset();
	this.DOMNode = null;
};

module.exports = ButtonPlugin;
