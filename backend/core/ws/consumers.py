"""WebSocket consumer for real-time notification delivery."""

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Push notifications to connected browsers via channel-layer groups."""

    async def connect(self):
        self.user = self.scope["user"]
        self.group_name = f"notifications_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify(self, event):
        """Handle channel-layer messages of type 'notify'."""
        await self.send_json(event["data"])
