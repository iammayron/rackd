package dev.rackd.wear;

import java.util.List;

/**
 * Which paired device should receive a watch action.
 * Capability discovery is the right signal when it works. On Wear OS 6 it often
 * comes back empty while the phone is still connected over Bluetooth, and the
 * phone app can keep logging sets. A connected node is that phone.
 */
public final class PhoneNode {
    public static final class Candidate {
        public final String id;
        public final boolean nearby;

        public Candidate(String id, boolean nearby) {
            this.id = id;
            this.nearby = nearby;
        }
    }

    private PhoneNode() {}

    public static boolean hasNearby(List<Candidate> nodes) {
        return nearby(nodes) != null;
    }

    /**
     * Nearby Bluetooth wins over a cloud-only node. A node that advertises the
     * phone app wins over a bare connection when both are the same kind of link.
     */
    public static String pick(List<Candidate> capabilityNodes, List<Candidate> connectedNodes) {
        String nearbyCapable = nearby(capabilityNodes);
        if (nearbyCapable != null) return nearbyCapable;
        String nearbyConnected = nearby(connectedNodes);
        if (nearbyConnected != null) return nearbyConnected;
        String capable = any(capabilityNodes);
        if (capable != null) return capable;
        return any(connectedNodes);
    }

    private static String nearby(List<Candidate> nodes) {
        if (nodes == null) return null;
        for (Candidate node : nodes) {
            if (usable(node) && node.nearby) return node.id;
        }
        return null;
    }

    private static String any(List<Candidate> nodes) {
        if (nodes == null) return null;
        for (Candidate node : nodes) {
            if (usable(node)) return node.id;
        }
        return null;
    }

    private static boolean usable(Candidate node) {
        return node != null && node.id != null && !node.id.isEmpty();
    }
}
