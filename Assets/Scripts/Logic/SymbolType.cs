namespace SlotGame.Logic
{
    /// <summary>
    /// Identifies the distinct reel symbols available in the slot machine.
    /// Ordered according to classic slot machine payout hierarchies.
    /// </summary>
    public enum SymbolType
    {
        Cherry = 0,    // Standard frequent payout (also pays on 2 matches)
        Bell = 1,      // Medium payout
        Bar = 2,       // High payout
        Seven = 3      // Jackpot symbol (highest payout)
    }
}
