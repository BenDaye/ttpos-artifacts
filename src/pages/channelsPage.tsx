import React from "react";
import { AppLayout } from "../components/AppLayout";
import { CreateChannelModal } from "../components/CreateChannelModal";
import { EditChannelModal } from "../components/EditChannelModal";
import { ChannelCard } from "../components/ChannelCard";
import { DeleteChannelConfirmationModal } from "../components/DeleteChannelConfirmationModal";
import { useChannelQuery, Channel } from "../hooks/use-query/useChannelQuery";
import { useSearch } from "../hooks/useSearch";
export const ChannelsPage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [selectedChannel, setSelectedChannel] = React.useState<Channel | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = React.useState(false);
  const [channelToDelete, setChannelToDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);
  const openEditModal = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsEditModalOpen(true);
  };
  const closeEditModal = () => {
    setSelectedChannel(null);
    setIsEditModalOpen(false);
  };

  const { channels, deleteChannel, isLoading } = useChannelQuery();
  const filteredChannels = useSearch(channels, searchTerm) as Channel[];

  const handleDelete = async (channelId: string, channelName: string) => {
    setChannelToDelete({ id: channelId, name: channelName });
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (channelToDelete) {
      try {
        await deleteChannel(channelToDelete.id);
        setDeleteConfirmationOpen(false);
        setChannelToDelete(null);
      } catch (error) {
        console.error("Error deleting channel:", error);
        throw error;
      }
    }
  };

  return (
    <AppLayout
      title="Channels"
      onCreateClick={openCreateModal}
      createButtonText="Create Channel"
      onSearchChange={setSearchTerm}
    >
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary" />
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {searchTerm
            ? "No channels found matching your search."
            : "No channels have been created yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map((channel) => (
            <ChannelCard
              key={channel.ID}
              name={channel.ChannelName}
              onClick={() => openEditModal(channel)}
              onDelete={() => handleDelete(channel.ID, channel.ChannelName)}
            />
          ))}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateChannelModal onClose={closeCreateModal} />
      )}

      {isEditModalOpen && selectedChannel && (
        <EditChannelModal
          channelName={selectedChannel.ChannelName}
          channelId={selectedChannel.ID}
          onClose={closeEditModal}
        />
      )}

      {deleteConfirmationOpen && channelToDelete && (
        <DeleteChannelConfirmationModal
          channelId={channelToDelete.id}
          channelName={channelToDelete.name}
          onClose={() => {
            setDeleteConfirmationOpen(false);
            setChannelToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </AppLayout>
  );
};
