"""
Friends & Invitations URL routes.
"""

from django.urls import path

from core.friends.views import (
    FriendListView,
    FriendRemoveView,
    InvitationDetailView,
    InvitationListView,
    InviteView,
)

urlpatterns = [
    path("", FriendListView.as_view(), name="friend-list"),
    path("invite/", InviteView.as_view(), name="friend-invite"),
    path("invitations/", InvitationListView.as_view(), name="invitation-list"),
    path(
        "invitations/<int:pk>/",
        InvitationDetailView.as_view(),
        name="invitation-detail",
    ),
    path("<int:user_id>/", FriendRemoveView.as_view(), name="friend-remove"),
]
